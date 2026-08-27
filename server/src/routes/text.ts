import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { requireAuth, requireWrite } from '../lib/auth.js';
import { forgetPath } from '../lib/db.js';
import { classify, isTextual } from '../lib/filetypes.js';
import { normalizeRelative, PathError, resolveExisting, TEMP_PREFIX } from '../lib/paths.js';

/**
 * A JSON body carrying UTF-8 text can be several times the file's byte length
 * once escaping and multi-byte characters are counted, so the save route needs
 * headroom well above MAX_TEXT_BYTES.
 */
const SAVE_BODY_LIMIT = 16 * 1024 * 1024;

interface TextDocument {
  path: string;
  content: string;
  size: number;
  modifiedAt: number;
  kind: string;
}

/**
 * Read a file as UTF-8, refusing anything that is not really text. The
 * extension already said it should be, but a `.log` full of binary rubbish
 * would otherwise come back as a screen of replacement characters.
 */
async function readTextFile(relPath: string, absolute: string): Promise<TextDocument> {
  const stat = await fs.stat(absolute);
  if (!stat.isFile()) throw new PathError('Not a file');

  if (stat.size > config.maxTextBytes) {
    throw new PathError(
      `This file is larger than the ${Math.round(config.maxTextBytes / 1024 / 1024)} MB edit limit — download it instead`,
      413,
    );
  }

  const buffer = await fs.readFile(absolute);
  if (buffer.includes(0)) throw new PathError('This file contains binary data, not text');

  return {
    path: relPath,
    content: buffer.toString('utf8'),
    size: stat.size,
    modifiedAt: Math.round(stat.mtimeMs),
    kind: classify(path.basename(relPath)).kind,
  };
}

export default async function textRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  /** Contents of a text file, for the in-app viewer/editor. */
  app.get<{ Querystring: { path?: string } }>('/api/text', async (request) => {
    const relPath = normalizeRelative(request.query.path);
    if (!relPath) throw new PathError('A file path is required');
    if (!isTextual(path.basename(relPath))) {
      throw new PathError('That file type cannot be opened as text');
    }

    const absolute = await resolveExisting(relPath);
    return readTextFile(relPath, absolute);
  });

  /**
   * Overwrite a text file with edited contents. The write goes to a temp file
   * beside the original and is renamed into place, so a dropped connection
   * mid-save leaves the previous version intact rather than a truncated file.
   */
  app.put<{ Body: { path?: string; content?: string; modifiedAt?: number } }>(
    '/api/text',
    { preHandler: requireWrite, bodyLimit: SAVE_BODY_LIMIT },
    async (request) => {
      const relPath = normalizeRelative(request.body?.path);
      if (!relPath) throw new PathError('A file path is required');
      if (!isTextual(path.basename(relPath))) {
        throw new PathError('That file type cannot be saved as text');
      }

      const content = request.body?.content;
      if (typeof content !== 'string') throw new PathError('No content given');

      const bytes = Buffer.from(content, 'utf8');
      if (bytes.byteLength > config.maxTextBytes) {
        throw new PathError('The edited file is over the size limit', 413);
      }

      const absolute = await resolveExisting(relPath);
      const before = await fs.stat(absolute);
      if (!before.isFile()) throw new PathError('Not a file');

      // Optimistic concurrency: the editor sends back the mtime it loaded, so
      // a file changed by someone else in the meantime is refused rather than
      // silently overwritten.
      const expected = request.body?.modifiedAt;
      if (typeof expected === 'number' && Math.round(before.mtimeMs) !== expected) {
        throw new PathError('This file changed on the server since you opened it', 409);
      }

      const directory = path.dirname(absolute);
      const temporary = path.join(
        directory,
        `${TEMP_PREFIX}${crypto.randomBytes(8).toString('hex')}.tmp`,
      );

      try {
        await fs.writeFile(temporary, bytes);
        // A rename resets the mode to the default, so carry the original over.
        await fs.chmod(temporary, before.mode & 0o777);
        await fs.rename(temporary, absolute);
      } catch (error) {
        await fs.rm(temporary, { force: true });
        throw error;
      }

      // The cached digest and thumbnail were computed from the old bytes.
      forgetPath(relPath);

      const after = await fs.stat(absolute);
      request.log.info(
        { user: request.identity.login, file: relPath, size: after.size },
        'text save',
      );

      return { path: relPath, size: after.size, modifiedAt: Math.round(after.mtimeMs) };
    },
  );
}
