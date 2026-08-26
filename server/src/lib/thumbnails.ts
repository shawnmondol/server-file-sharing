import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';
import { getThumbState, setThumbState } from './db.js';
import { classify, isSharpReadable } from './filetypes.js';

/**
 * Thumbnails are generated lazily on first request and cached to disk under a
 * key that includes mtime and size, so a replaced file gets a new key and the
 * browser never sees a stale image.
 */
function cacheKey(relPath: string, mtimeMs: number, size: number): string {
  return crypto.createHash('sha1').update(`${relPath}:${mtimeMs}:${size}`).digest('hex');
}

function cachePath(key: string): string {
  // Two-level fan-out keeps any single directory from growing unwieldy.
  return path.join(config.thumbnailDir, key.slice(0, 2), `${key}.jpg`);
}

/**
 * The Pi has four cores and ffmpeg is happy to use all of them. Cap concurrent
 * generation so a freshly opened gallery of 200 videos does not stall the
 * event loop or thrash the SD card.
 */
const MAX_CONCURRENT = 2;
let active = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(work: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  active += 1;
  try {
    return await work();
  } finally {
    active -= 1;
    waiting.shift()?.();
  }
}

async function generateImageThumb(source: string, destination: string): Promise<void> {
  await sharp(source, { failOn: 'none', animated: false })
    .rotate() // honour EXIF orientation
    .resize(config.thumbnailSize, config.thumbnailSize, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toFile(destination);
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      // Keep only the tail; ffmpeg is verbose and we just want the error.
      stderr = (stderr + chunk.toString()).slice(-2000);
    });

    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with ${code}: ${stderr.trim()}`));
    });
  });
}

async function generateVideoThumb(source: string, destination: string): Promise<void> {
  // Seek before -i so ffmpeg jumps rather than decoding up to the timestamp.
  // One second in avoids the black frame most recordings open on.
  await runFfmpeg(
    [
      '-hide_banner', '-loglevel', 'error', '-nostdin',
      '-ss', '1',
      '-i', source,
      '-frames:v', '1',
      '-vf', `scale='min(${config.thumbnailSize},iw)':-2`,
      '-q:v', '4',
      '-y', destination,
    ],
    30_000,
  );
}

export interface ThumbnailResult {
  path: string;
}

/**
 * Return the on-disk path of the thumbnail for a file, generating it if
 * needed. Returns null when this file cannot have one — an unsupported
 * format, a missing ffmpeg, or a previous failure we already recorded.
 */
export async function getThumbnail(
  relPath: string,
  absolutePath: string,
  mtimeMs: number,
  size: number,
): Promise<ThumbnailResult | null> {
  const { category } = classify(path.basename(relPath));
  if (category !== 'image' && category !== 'video') return null;
  if (category === 'video' && !config.enableVideoThumbnails) return null;
  if (category === 'image' && !isSharpReadable(relPath)) return null;

  const key = cacheKey(relPath, mtimeMs, size);
  const destination = cachePath(key);

  try {
    await fs.access(destination);
    return { path: destination };
  } catch {
    // Not cached yet — fall through and generate.
  }

  // A file that failed once (corrupt, unsupported codec) would otherwise be
  // retried on every gallery scroll.
  if (getThumbState(relPath, mtimeMs, size) === 'unavailable') return null;

  return withSlot(async () => {
    // Another request may have finished generating while we waited for a slot.
    try {
      await fs.access(destination);
      return { path: destination };
    } catch {
      // Still missing — generate it.
    }

    await fs.mkdir(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.${process.pid}.tmp`;

    try {
      if (category === 'image') await generateImageThumb(absolutePath, temporary);
      else await generateVideoThumb(absolutePath, temporary);

      // Rename is atomic within a filesystem, so readers never see a partial file.
      await fs.rename(temporary, destination);
      setThumbState(relPath, mtimeMs, size, 'ready');
      return { path: destination };
    } catch {
      await fs.rm(temporary, { force: true });
      setThumbState(relPath, mtimeMs, size, 'unavailable');
      return null;
    }
  });
}

/**
 * Delete cached thumbnails that have not been touched in a while. Called once
 * at startup; keys are content-addressed so stale entries are pure waste.
 */
export async function pruneThumbnailCache(maxAgeDays = 60): Promise<number> {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let removed = 0;

  let shards: string[];
  try {
    shards = await fs.readdir(config.thumbnailDir);
  } catch {
    return 0;
  }

  for (const shard of shards) {
    const shardDir = path.join(config.thumbnailDir, shard);
    let entries: string[];
    try {
      entries = await fs.readdir(shardDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(shardDir, entry);
      try {
        const stat = await fs.stat(full);
        if (stat.mtimeMs < cutoff) {
          await fs.rm(full, { force: true });
          removed += 1;
        }
      } catch {
        // Raced with another prune or a delete; nothing to do.
      }
    }
  }

  return removed;
}
