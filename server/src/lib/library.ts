import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.js';
import {
  CATEGORY_ORDER,
  type Category,
  classify,
  previewMode,
  type PreviewMode,
} from './filetypes.js';
import { resolveExisting, toRelative } from './paths.js';
import { supportedThumbnailKind } from './thumbnails.js';

export interface Entry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  /** Item count for folders; null for files. */
  childCount: number | null;
  category: Category;
  kind: string;
  mime: string;
  /** Creation time where the filesystem records one, else mtime. */
  addedAt: number;
  modifiedAt: number;
  owner: string;
  mode: string;
  hasThumbnail: boolean;
  /** Which viewer the overlay should use, or null to download instead. */
  preview: PreviewMode | null;
}

export interface DiskUsage {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
}

/**
 * uid → username, read from /etc/passwd once. Falls back to the numeric id
 * when the file is unreadable or the user is not listed (LDAP, containers).
 */
let uidNames: Map<number, string> | null = null;

function usernameFor(uid: number): string {
  if (!uidNames) {
    uidNames = new Map();
    try {
      const passwd = fsSync.readFileSync('/etc/passwd', 'utf8');
      for (const line of passwd.split('\n')) {
        const [name, , id] = line.split(':');
        if (name && id !== undefined) {
          const parsed = Number(id);
          if (Number.isInteger(parsed)) uidNames.set(parsed, name);
        }
      }
    } catch {
      // Leave the map empty; every lookup falls back to the numeric uid.
    }
    try {
      uidNames.set(os.userInfo().uid, os.userInfo().username);
    } catch {
      // userInfo throws on some minimal images; numeric ids are fine.
    }
  }
  return uidNames.get(uid) ?? String(uid);
}

/** Cheap child count so folder tiles can say "12 items" instead of a size. */
async function countChildren(directory: string): Promise<number | null> {
  try {
    const entries = await fs.readdir(directory);
    return entries.filter((name) => !name.startsWith('.')).length;
  } catch {
    return null;
  }
}

async function toEntry(directory: string, name: string): Promise<Entry | null> {
  const absolute = path.join(directory, name);

  let stat: fsSync.Stats;
  try {
    // lstat first: a symlink pointing outside the share must not be followed.
    const link = await fs.lstat(absolute);
    if (link.isSymbolicLink()) {
      try {
        await resolveExisting(toRelative(absolute));
      } catch {
        return null; // Points outside the library — hide it entirely.
      }
    }
    stat = await fs.stat(absolute);
  } catch {
    return null; // Deleted between readdir and stat.
  }

  if (!stat.isDirectory() && !stat.isFile()) return null; // Sockets, devices, FIFOs.

  const isDirectory = stat.isDirectory();
  const spec = isDirectory
    ? { category: 'folder' as Category, kind: 'Folder', mime: 'inode/directory' }
    : classify(name);

  // ext4 records a creation time and Node surfaces it as birthtime. Where it
  // is unavailable the kernel reports mtime, which is the sensible fallback
  // anyway: for an uploaded file the two are the same moment.
  const birth = stat.birthtimeMs > 0 ? stat.birthtimeMs : stat.mtimeMs;

  return {
    name,
    path: toRelative(absolute),
    isDirectory,
    size: isDirectory ? 0 : stat.size,
    childCount: isDirectory ? await countChildren(absolute) : null,
    category: spec.category,
    kind: spec.kind,
    mime: spec.mime,
    addedAt: Math.round(Math.min(birth, stat.mtimeMs)),
    modifiedAt: Math.round(stat.mtimeMs),
    owner: usernameFor(stat.uid),
    mode: (stat.mode & 0o777).toString(8).padStart(3, '0'),
    hasThumbnail: !isDirectory && supportedThumbnailKind(name) !== null,
    preview: isDirectory ? null : previewMode(name),
  };
}

/** Entries directly inside one folder. Dotfiles are hidden. */
export async function listDirectory(relPath: string): Promise<Entry[]> {
  const absolute = await resolveExisting(relPath);
  const names = await fs.readdir(absolute);
  const entries = await Promise.all(
    names.filter((name) => !name.startsWith('.')).map((name) => toEntry(absolute, name)),
  );
  return entries.filter((entry): entry is Entry => entry !== null);
}

/** Guard against a pathological tree turning one search into a very long walk. */
const SEARCH_ENTRY_LIMIT = 20_000;
const SEARCH_DEPTH_LIMIT = 12;

/**
 * Recursive filename search rooted at `relPath`. Folders are included when
 * their own name matches, but are still descended into either way.
 */
export async function searchTree(relPath: string, query: string): Promise<Entry[]> {
  const needle = query.trim().toLowerCase();
  if (!needle) return listDirectory(relPath);

  const root = await resolveExisting(relPath);
  const results: Entry[] = [];
  let visited = 0;

  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > SEARCH_DEPTH_LIMIT || visited >= SEARCH_ENTRY_LIMIT) return;

    let names: string[];
    try {
      names = await fs.readdir(directory);
    } catch {
      return;
    }

    for (const name of names) {
      if (name.startsWith('.')) continue;
      if (visited >= SEARCH_ENTRY_LIMIT) return;
      visited += 1;

      const entry = await toEntry(directory, name);
      if (!entry) continue;

      if (name.toLowerCase().includes(needle)) results.push(entry);
      if (entry.isDirectory) await walk(path.join(directory, name), depth + 1);
    }
  }

  await walk(root, 0);
  return results;
}

export type SortKey = 'name' | 'size' | 'date';
export type SortDirection = 'asc' | 'desc';

/**
 * Sort in place. Folders always lead regardless of direction — a folder has no
 * meaningful size, and interleaving them makes the grid hard to scan.
 */
export function sortEntries(entries: Entry[], key: SortKey, direction: SortDirection): Entry[] {
  const sign = direction === 'asc' ? 1 : -1;
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  return entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;

    let result: number;
    if (key === 'size') result = a.size - b.size;
    else if (key === 'date') result = a.addedAt - b.addedAt;
    else result = collator.compare(a.name, b.name);

    // Ties fall back to name so the order is stable across requests.
    return (result === 0 ? collator.compare(a.name, b.name) : result * sign);
  });
}

/** Counts per category for the filter chips, in a stable display order. */
export function countByCategory(entries: Entry[]): Array<{ category: Category; count: number }> {
  const counts = new Map<Category, number>();
  for (const entry of entries) {
    counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  }
  return CATEGORY_ORDER.filter((category) => counts.has(category)).map((category) => ({
    category,
    count: counts.get(category) ?? 0,
  }));
}

export async function diskUsage(): Promise<DiskUsage> {
  const stat = await fs.statfs(config.shareRoot);
  const totalBytes = stat.blocks * stat.bsize;
  const freeBytes = stat.bavail * stat.bsize;
  return { totalBytes, freeBytes, usedBytes: totalBytes - freeBytes };
}

/** Breadcrumb trail from the share root down to `relPath`. */
export function breadcrumbs(relPath: string): Array<{ name: string; path: string }> {
  const trail = [{ name: 'Shared Files', path: '' }];
  if (!relPath) return trail;

  let accumulated = '';
  for (const segment of relPath.split('/')) {
    accumulated = accumulated ? `${accumulated}/${segment}` : segment;
    trail.push({ name: segment, path: accumulated });
  }
  return trail;
}
