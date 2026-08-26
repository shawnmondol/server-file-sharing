import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { UPLOAD_TEMP_PREFIX } from '../routes/transfer.js';

const SWEEP_DEPTH_LIMIT = 12;
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Remove upload temp files left behind by a crash or a power cut. They are
 * dotfiles so they never appeared in the gallery, but they still occupy disk.
 * One bounded walk at startup is enough — nothing else creates them.
 */
export async function sweepOrphanedUploads(): Promise<number> {
  const cutoff = Date.now() - ORPHAN_AGE_MS;
  let removed = 0;

  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > SWEEP_DEPTH_LIMIT) return;

    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
        continue;
      }
      if (!entry.name.startsWith(UPLOAD_TEMP_PREFIX)) continue;

      try {
        const stat = await fs.stat(full);
        // Only sweep old ones — a fresh temp file may be an upload in flight.
        if (stat.mtimeMs < cutoff) {
          await fs.rm(full, { force: true });
          removed += 1;
        }
      } catch {
        // Already gone.
      }
    }
  }

  await walk(config.shareRoot, 0);
  return removed;
}
