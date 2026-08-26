import archiver from 'archiver';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { config } from '../config.js';
import { requireAuth, requireWrite } from '../lib/auth.js';
import { classify } from '../lib/filetypes.js';
import {
  findAvailableName,
  normalizeRelative,
  PathError,
  resolveExisting,
  toRelative,
} from '../lib/paths.js';
import { getThumbnail } from '../lib/thumbnails.js';

/** Temp files are dotfiles so an interrupted upload never shows in the gallery. */
export const UPLOAD_TEMP_PREFIX = '.fileshare-upload-';

/**
 * RFC 6266 filename, ASCII fallback plus a UTF-8 form so names with accents or
 * emoji survive the round trip.
 */
function contentDisposition(kind: 'attachment' | 'inline', filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Parse a single-range `Range` header. Multi-range requests are not supported. */
function parseRange(header: string | undefined, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  let start: number;
  let end: number;

  if (rawStart === '') {
    // A suffix range: the last N bytes.
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Number(rawEnd);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

async function sendFile(
  reply: FastifyReply,
  absolutePath: string,
  filename: string,
  disposition: 'attachment' | 'inline',
  rangeHeader: string | undefined,
): Promise<FastifyReply> {
  const stat = await fs.stat(absolutePath);
  if (!stat.isFile()) throw new PathError('Not a file');

  const { mime } = classify(filename);
  // A weak validator is enough here and stays correct if the file is replaced.
  const etag = `W/"${stat.size.toString(16)}-${Math.round(stat.mtimeMs).toString(16)}"`;

  reply
    .header('Content-Type', disposition === 'inline' ? mime : 'application/octet-stream')
    .header('Content-Disposition', contentDisposition(disposition, filename))
    .header('Accept-Ranges', 'bytes')
    .header('Last-Modified', new Date(stat.mtimeMs).toUTCString())
    .header('ETag', etag)
    .header('Cache-Control', 'private, max-age=0, must-revalidate');

  const range = parseRange(rangeHeader, stat.size);
  if (rangeHeader && !range) {
    return reply.code(416).header('Content-Range', `bytes */${stat.size}`).send();
  }

  if (range) {
    // Range support is what lets iOS Safari scrub a video in the preview
    // overlay instead of downloading the whole file first.
    reply
      .code(206)
      .header('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`)
      .header('Content-Length', range.end - range.start + 1);
    return reply.send(createReadStream(absolutePath, { start: range.start, end: range.end }));
  }

  reply.header('Content-Length', stat.size);
  return reply.send(createReadStream(absolutePath));
}

/**
 * Bundle downloads are two steps: a POST that validates the selection and
 * hands back a token, then a GET the browser navigates to. Streaming a zip
 * straight out of the POST would force the client to buffer gigabytes in
 * memory before it could save anything.
 */
interface Bundle {
  paths: string[];
  login: string;
  expiresAt: number;
}

const bundles = new Map<string, Bundle>();
const BUNDLE_TTL_MS = 5 * 60 * 1000;

function sweepBundles(): void {
  const now = Date.now();
  for (const [token, bundle] of bundles) {
    if (bundle.expiresAt < now) bundles.delete(token);
  }
}

export default async function transferRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get<{ Querystring: { path?: string } }>('/api/download', async (request, reply) => {
    const relPath = normalizeRelative(request.query.path);
    if (!relPath) throw new PathError('A file path is required');

    const absolute = await resolveExisting(relPath);
    const stat = await fs.stat(absolute);
    if (stat.isDirectory()) throw new PathError('Use a bundle download for folders');

    return sendFile(reply, absolute, path.basename(relPath), 'attachment', request.headers.range);
  });

  /** Same bytes, inline, for the Quick Look–style preview overlay. */
  app.get<{ Querystring: { path?: string } }>('/api/preview', async (request, reply) => {
    const relPath = normalizeRelative(request.query.path);
    if (!relPath) throw new PathError('A file path is required');

    const absolute = await resolveExisting(relPath);
    return sendFile(reply, absolute, path.basename(relPath), 'inline', request.headers.range);
  });

  app.get<{ Querystring: { path?: string } }>('/api/thumbnail', async (request, reply) => {
    const relPath = normalizeRelative(request.query.path);
    if (!relPath) throw new PathError('A file path is required');

    const absolute = await resolveExisting(relPath);
    const stat = await fs.stat(absolute);
    if (stat.isDirectory()) return reply.code(404).send({ error: 'Folders have no thumbnail' });

    const thumb = await getThumbnail(relPath, absolute, Math.round(stat.mtimeMs), stat.size);
    if (!thumb) return reply.code(404).send({ error: 'No thumbnail for this file' });

    return reply
      .header('Content-Type', 'image/jpeg')
      // The cache key includes mtime and size, so a hit can never be stale.
      .header('Cache-Control', 'private, max-age=31536000, immutable')
      .send(createReadStream(thumb.path));
  });

  app.post<{ Body: { paths?: string[] } }>('/api/bundles', async (request, reply) => {
    sweepBundles();

    const requested = request.body?.paths;
    if (!Array.isArray(requested) || requested.length === 0) {
      throw new PathError('No paths given');
    }
    if (requested.length > 500) {
      throw new PathError('Too many paths in one bundle (max 500)');
    }

    // Validate every path now, while there is still a JSON response to fail
    // into — once the zip stream has started we cannot change the status code.
    const paths: string[] = [];
    for (const raw of requested) {
      const relPath = normalizeRelative(raw);
      if (!relPath) throw new PathError('The share root cannot be bundled');
      await resolveExisting(relPath);
      paths.push(relPath);
    }

    const token = crypto.randomBytes(24).toString('base64url');
    bundles.set(token, { paths, login: request.identity.login, expiresAt: Date.now() + BUNDLE_TTL_MS });

    reply.code(201);
    return { token, expiresAt: Date.now() + BUNDLE_TTL_MS, count: paths.length };
  });

  app.get<{ Params: { token: string } }>('/api/bundles/:token', async (request, reply) => {
    sweepBundles();

    const bundle = bundles.get(request.params.token);
    // Tokens are single-user: a link leaked to another tailnet account is inert.
    if (!bundle || bundle.login !== request.identity.login) {
      return reply.code(404).send({ error: 'That download link has expired' });
    }
    bundles.delete(request.params.token);

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = bundle.paths.length === 1
      ? `${path.basename(bundle.paths[0] ?? 'files')}.zip`
      : `shared-files-${stamp}.zip`;

    reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', contentDisposition('attachment', filename))
      .header('Cache-Control', 'no-store');

    // No compression: most of what gets bundled is already compressed, and
    // deflating gigabytes would peg the Pi's CPU for no size win.
    const archive = archiver('zip', { store: true });
    archive.on('warning', (error) => request.log.warn({ error }, 'archiver warning'));
    archive.on('error', (error) => {
      request.log.error({ error }, 'archiver failed');
      archive.destroy();
    });

    for (const relPath of bundle.paths) {
      const absolute = await resolveExisting(relPath);
      const stat = await fs.stat(absolute);
      const name = path.basename(relPath);
      if (stat.isDirectory()) archive.directory(absolute, name);
      else archive.file(absolute, { name });
    }

    void archive.finalize();
    return reply.send(archive);
  });

  app.post<{ Querystring: { path?: string } }>(
    '/api/upload',
    { preHandler: requireWrite },
    async (request, reply) => {
      const folder = normalizeRelative(request.query.path);
      const directory = await resolveExisting(folder);
      const stat = await fs.stat(directory);
      if (!stat.isDirectory()) throw new PathError('Upload destination is not a folder');

      const uploaded: Array<{ path: string; name: string; size: number }> = [];
      const rejected: Array<{ name: string; reason: string }> = [];

      for await (const part of request.parts()) {
        if (part.type !== 'file') continue;

        const original = path.basename(part.filename || 'upload');
        let temporary: string | null = null;

        try {
          // Write beside the destination, not in DATA_DIR: the final rename is
          // then guaranteed to be same-filesystem, and therefore atomic.
          const suffix = crypto.randomBytes(8).toString('hex');
          temporary = path.join(directory, `${UPLOAD_TEMP_PREFIX}${suffix}.tmp`);

          await pipeline(part.file, createWriteStream(temporary));

          // @fastify/multipart stops the stream at the size limit rather than
          // throwing, so the flag has to be checked after it drains.
          if (part.file.truncated) {
            throw new PathError(`Larger than the ${config.maxUploadBytes} byte limit`, 413);
          }

          const finalName = await findAvailableName(directory, original);
          const destination = path.join(directory, finalName);
          await fs.rename(temporary, destination);
          temporary = null;

          const written = await fs.stat(destination);
          uploaded.push({ path: toRelative(destination), name: finalName, size: written.size });
          request.log.info(
            { user: request.identity.login, file: toRelative(destination), size: written.size },
            'upload',
          );
        } catch (error) {
          if (temporary) await fs.rm(temporary, { force: true });
          rejected.push({
            name: original,
            reason: error instanceof Error ? error.message : 'Upload failed',
          });
        }
      }

      if (uploaded.length === 0 && rejected.length > 0) reply.code(422);
      return { uploaded, rejected };
    },
  );
}
