import type { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { requireAuth, requireWrite } from '../lib/auth.js';
import { forgetPath } from '../lib/db.js';
import { sha256, zipEntryCount } from '../lib/details.js';
import { classify } from '../lib/filetypes.js';
import {
  breadcrumbs,
  countByCategory,
  diskUsage,
  listDirectory,
  searchTree,
  sortEntries,
  type SortDirection,
  type SortKey,
} from '../lib/library.js';
import { normalizeRelative, PathError, resolveExisting, resolveNew, toRelative } from '../lib/paths.js';

interface BrowseQuery {
  path?: string;
  q?: string;
  category?: string;
  sort?: string;
  direction?: string;
}

function parseSort(value: string | undefined): SortKey {
  return value === 'size' || value === 'date' || value === 'name' ? value : 'date';
}

function parseDirection(value: string | undefined, key: SortKey): SortDirection {
  if (value === 'asc' || value === 'desc') return value;
  // Newest-first and largest-first are the useful defaults; name reads A→Z.
  return key === 'name' ? 'asc' : 'desc';
}

export default async function fileRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  /** The one read endpoint the gallery needs: entries, chips, and breadcrumbs. */
  app.get<{ Querystring: BrowseQuery }>('/api/browse', async (request) => {
    const folder = normalizeRelative(request.query.path);
    const query = (request.query.q ?? '').trim();
    const sort = parseSort(request.query.sort);
    const direction = parseDirection(request.query.direction, sort);

    const all = query ? await searchTree(folder, query) : await listDirectory(folder);

    // Chip counts describe the unfiltered result set, so the numbers do not
    // shift as you click between chips.
    const categories = countByCategory(all);

    const category = request.query.category;
    const filtered = category && category !== 'all'
      ? all.filter((entry) => entry.category === category)
      : all;

    return {
      path: folder,
      query,
      sort,
      direction,
      breadcrumbs: breadcrumbs(folder),
      entries: sortEntries(filtered, sort, direction),
      totalCount: all.length,
      totalBytes: all.reduce((sum, entry) => sum + entry.size, 0),
      categories,
      disk: await diskUsage(),
    };
  });

  /** Inspector detail: the expensive fields, fetched only for a selected file. */
  app.get<{ Querystring: { path?: string } }>('/api/details', async (request) => {
    const relPath = normalizeRelative(request.query.path);
    if (!relPath) throw new PathError('A file path is required');

    const absolute = await resolveExisting(relPath);
    const stat = await fs.stat(absolute);

    if (stat.isDirectory()) {
      const children = await listDirectory(relPath);
      return {
        path: relPath,
        isDirectory: true,
        childCount: children.length,
        totalBytes: children.reduce((sum, entry) => sum + entry.size, 0),
      };
    }

    const [digest, entries] = await Promise.all([
      sha256(relPath, absolute),
      zipEntryCount(absolute),
    ]);

    return {
      path: relPath,
      isDirectory: false,
      sha256: digest,
      archiveEntries: entries,
      kind: classify(path.basename(relPath)).kind,
    };
  });

  app.post<{ Body: { path?: string; name?: string } }>(
    '/api/folders',
    { preHandler: requireWrite },
    async (request, reply) => {
      const parent = normalizeRelative(request.body?.path);
      const name = request.body?.name ?? '';
      const target = await resolveNew(parent, name);

      try {
        await fs.mkdir(target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          throw new PathError('Something with that name already exists', 409);
        }
        throw error;
      }

      reply.code(201);
      return { path: toRelative(target) };
    },
  );

  /**
   * Bulk delete. Deletes are permanent — there is no trash — which is what the
   * confirmation sheet in the UI warns about. Failures are reported per path
   * rather than aborting, so one locked file does not strand the rest.
   */
  app.post<{ Body: { paths?: string[] } }>(
    '/api/delete',
    { preHandler: requireWrite },
    async (request) => {
      const requested = request.body?.paths;
      if (!Array.isArray(requested) || requested.length === 0) {
        throw new PathError('No paths given');
      }
      if (requested.length > 500) {
        throw new PathError('Too many paths in one request (max 500)');
      }

      const deleted: string[] = [];
      const failed: Array<{ path: string; reason: string }> = [];

      for (const raw of requested) {
        let relPath = '';
        try {
          relPath = normalizeRelative(raw);
          if (!relPath) throw new PathError('The share root cannot be deleted');

          const absolute = await resolveExisting(relPath);
          await fs.rm(absolute, { recursive: true, force: false });
          forgetPath(relPath);
          deleted.push(relPath);
        } catch (error) {
          failed.push({
            path: relPath || String(raw),
            reason: error instanceof Error ? error.message : 'Delete failed',
          });
        }
      }

      request.log.info({ user: request.identity.login, deleted: deleted.length }, 'delete');
      return { deleted, failed };
    },
  );
}
