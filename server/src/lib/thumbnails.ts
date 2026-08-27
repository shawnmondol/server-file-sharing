import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config.js';
import { getThumbState, setThumbState } from './db.js';
import { thumbnailKind, type ThumbKind } from './filetypes.js';

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

/**
 * First page of a PDF, via poppler's pdftoppm. `-singlefile` makes it write
 * `<prefix>.jpg` rather than appending a page number, so the output path is
 * predictable.
 */
async function generatePdfThumb(source: string, destination: string): Promise<void> {
  const prefix = destination.replace(/\.jpg$/, '');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      config.pdftoppmPath,
      ['-jpeg', '-f', '1', '-l', '1', '-singlefile', '-scale-to', String(config.thumbnailSize), source, prefix],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });

    const timer = setTimeout(() => child.kill('SIGKILL'), 20_000);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`pdftoppm exited with ${code}: ${stderr.trim()}`));
    });
  });
}

const TEXT_PREVIEW_LINES = 16;
const TEXT_PREVIEW_COLUMNS = 46;
/** Enough bytes to fill the preview even if the file opens with long lines. */
const TEXT_SAMPLE_BYTES = 8 * 1024;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A page-of-text thumbnail: the opening lines of the file drawn onto a sheet,
 * so a folder of notes reads as a folder of notes rather than a wall of
 * identical "TXT" badges. Rendered as an SVG and rasterised by sharp, which
 * this build of libvips can do through librsvg — no extra binary needed.
 */
async function generateTextThumb(source: string, destination: string): Promise<void> {
  const handle = await fs.open(source, 'r');
  let sample: string;
  try {
    const buffer = Buffer.alloc(TEXT_SAMPLE_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, TEXT_SAMPLE_BYTES, 0);
    const head = buffer.subarray(0, bytesRead);
    // A NUL byte means this is not really text, whatever the extension said.
    if (head.includes(0)) throw new Error('not text');
    sample = head.toString('utf8');
  } finally {
    await handle.close();
  }

  const lines = sample
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .slice(0, TEXT_PREVIEW_LINES)
    .map((line) => {
      // Tabs would otherwise collapse to a single glyph width in SVG text.
      const expanded = line.replace(/\t/g, '  ');
      return expanded.length > TEXT_PREVIEW_COLUMNS
        ? `${expanded.slice(0, TEXT_PREVIEW_COLUMNS - 1)}…`
        : expanded;
    });

  // Square, because the gallery tile is square and crops with object-cover —
  // a page-shaped sheet would lose its opening lines to the crop, which are
  // the only part worth showing.
  const width = config.thumbnailSize;
  const height = width;
  const fontSize = width / 34;
  const lineHeight = fontSize * 1.5;
  const marginX = width * 0.09;
  const marginTop = height * 0.1;

  const rows = lines
    .map((line, index) =>
      line.trim() === ''
        ? ''
        : `<text x="${marginX.toFixed(1)}" y="${(marginTop + index * lineHeight).toFixed(1)}">${escapeXml(line)}</text>`,
    )
    .filter(Boolean)
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
    `<g font-family="DejaVu Sans Mono, Menlo, Consolas, monospace" font-size="${fontSize.toFixed(2)}" fill="#3a3a3f" xml:space="preserve">${rows}</g>` +
    `</svg>`;

  await sharp(Buffer.from(svg), { density: 96 })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(destination);
}

export interface ThumbnailResult {
  path: string;
}

/**
 * The thumbnail kind for a file, narrowed to what this deployment can actually
 * render — video needs ffmpeg and PDF needs poppler, and either can be turned
 * off in `.env`. Shared with the browse listing so a tile only asks for a
 * thumbnail the server is able to produce.
 */
export function supportedThumbnailKind(filename: string): ThumbKind | null {
  const kind = thumbnailKind(filename);
  if (kind === 'video' && !config.enableVideoThumbnails) return null;
  if (kind === 'pdf' && !config.enablePdfThumbnails) return null;
  return kind;
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
  const kind = supportedThumbnailKind(path.basename(relPath));
  if (!kind) return null;

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
    // pdftoppm derives its output name from the prefix we hand it, so the
    // temp file has to keep the .jpg suffix for every renderer alike.
    const temporary = `${destination}.${process.pid}.tmp.jpg`;

    try {
      if (kind === 'image') await generateImageThumb(absolutePath, temporary);
      else if (kind === 'video') await generateVideoThumb(absolutePath, temporary);
      else if (kind === 'pdf') await generatePdfThumb(absolutePath, temporary);
      else await generateTextThumb(absolutePath, temporary);

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
