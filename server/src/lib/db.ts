import Database from 'better-sqlite3';
import { config } from '../config.js';

/**
 * A cache, not a source of truth. The filesystem is authoritative for what
 * exists; this only memoises work that is expensive to redo — SHA-256 digests
 * and failed thumbnail attempts. Every row is keyed by path plus the
 * mtime/size pair it was computed from, so an edited file invalidates itself.
 */
const db = new Database(config.databasePath);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS file_cache (
    rel_path    TEXT PRIMARY KEY,
    mtime_ms    INTEGER NOT NULL,
    size        INTEGER NOT NULL,
    sha256      TEXT,
    thumb_state TEXT,
    updated_at  INTEGER NOT NULL
  );
`);

interface CacheRow {
  rel_path: string;
  mtime_ms: number;
  size: number;
  sha256: string | null;
  thumb_state: string | null;
}

const selectRow = db.prepare<[string], CacheRow>('SELECT * FROM file_cache WHERE rel_path = ?');

const upsertHash = db.prepare(`
  INSERT INTO file_cache (rel_path, mtime_ms, size, sha256, updated_at)
  VALUES (@relPath, @mtimeMs, @size, @sha256, @now)
  ON CONFLICT(rel_path) DO UPDATE SET
    mtime_ms = @mtimeMs, size = @size, sha256 = @sha256,
    thumb_state = CASE WHEN file_cache.mtime_ms = @mtimeMs AND file_cache.size = @size
                       THEN file_cache.thumb_state ELSE NULL END,
    updated_at = @now
`);

const upsertThumbState = db.prepare(`
  INSERT INTO file_cache (rel_path, mtime_ms, size, thumb_state, updated_at)
  VALUES (@relPath, @mtimeMs, @size, @thumbState, @now)
  ON CONFLICT(rel_path) DO UPDATE SET
    mtime_ms = @mtimeMs, size = @size, thumb_state = @thumbState,
    sha256 = CASE WHEN file_cache.mtime_ms = @mtimeMs AND file_cache.size = @size
                  THEN file_cache.sha256 ELSE NULL END,
    updated_at = @now
`);

const deleteRow = db.prepare<[string]>('DELETE FROM file_cache WHERE rel_path = ?');
const deleteSubtree = db.prepare<[string, string]>("DELETE FROM file_cache WHERE rel_path = ? OR rel_path LIKE ? || '/%'");

/** A cached row is only usable if the file still has the same mtime and size. */
function freshRow(relPath: string, mtimeMs: number, size: number): CacheRow | null {
  const row = selectRow.get(relPath);
  if (!row) return null;
  if (row.mtime_ms !== mtimeMs || row.size !== size) return null;
  return row;
}

export function getCachedHash(relPath: string, mtimeMs: number, size: number): string | null {
  return freshRow(relPath, mtimeMs, size)?.sha256 ?? null;
}

export function setCachedHash(relPath: string, mtimeMs: number, size: number, sha256: string): void {
  upsertHash.run({ relPath, mtimeMs, size, sha256, now: Date.now() });
}

export type ThumbState = 'ready' | 'unavailable';

export function getThumbState(relPath: string, mtimeMs: number, size: number): ThumbState | null {
  const state = freshRow(relPath, mtimeMs, size)?.thumb_state ?? null;
  return state === 'ready' || state === 'unavailable' ? state : null;
}

export function setThumbState(relPath: string, mtimeMs: number, size: number, thumbState: ThumbState): void {
  upsertThumbState.run({ relPath, mtimeMs, size, thumbState, now: Date.now() });
}

/** Drop cache entries for a deleted file, or for a deleted folder's subtree. */
export function forgetPath(relPath: string): void {
  deleteRow.run(relPath);
  deleteSubtree.run(relPath, relPath);
}

export default db;
