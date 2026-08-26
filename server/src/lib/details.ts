import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { config } from '../config.js';
import { getCachedHash, setCachedHash } from './db.js';

/**
 * SHA-256 of a file, streamed so a 4 GB image never lands in memory. Cached in
 * SQLite against the file's mtime and size, so the second inspector open is
 * instant and an edited file re-hashes itself.
 */
export async function sha256(relPath: string, absolutePath: string): Promise<string | null> {
  const stat = await fs.stat(absolutePath);
  if (!stat.isFile()) return null;

  const cached = getCachedHash(relPath, Math.round(stat.mtimeMs), stat.size);
  if (cached) return cached;

  // Hashing a multi-gigabyte file saturates the Pi's IO for minutes. Above the
  // configured ceiling the inspector simply omits the digest.
  if (config.maxHashBytes > 0 && stat.size > config.maxHashBytes) return null;

  const hash = crypto.createHash('sha256');
  await pipeline(createReadStream(absolutePath), hash);
  const digest = hash.digest('hex');

  setCachedHash(relPath, Math.round(stat.mtimeMs), stat.size, digest);
  return digest;
}

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;

/** Max size of the end-of-central-directory record plus its comment. */
const EOCD_SEARCH_WINDOW = 66_000;

/**
 * Number of entries in a ZIP, read from the central directory record at the
 * end of the file — no decompression, one small read.
 *
 * Only ZIP is supported: a .tar.gz would have to be decompressed end to end to
 * be counted, which is not something to do on a metadata request.
 */
export async function zipEntryCount(absolutePath: string): Promise<number | null> {
  if (path.extname(absolutePath).toLowerCase() !== '.zip') return null;

  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(absolutePath, 'r');
    const { size } = await handle.stat();
    if (size < 22) return null;

    const windowSize = Math.min(size, EOCD_SEARCH_WINDOW);
    const window = Buffer.alloc(windowSize);
    await handle.read(window, 0, windowSize, size - windowSize);

    // The record is at the very end unless there is an archive comment, so
    // scan backwards for the signature.
    let eocd = -1;
    for (let offset = windowSize - 22; offset >= 0; offset -= 1) {
      if (window.readUInt32LE(offset) === EOCD_SIGNATURE) {
        eocd = offset;
        break;
      }
    }
    if (eocd === -1) return null;

    const count = window.readUInt16LE(eocd + 10);
    if (count !== 0xffff) return count;

    // 0xFFFF is the ZIP64 sentinel: the real count lives in the ZIP64 record,
    // located via a 20-byte locator immediately before the EOCD.
    const locator = eocd - 20;
    if (locator < 0 || window.readUInt32LE(locator) !== ZIP64_LOCATOR_SIGNATURE) return null;

    const zip64Offset = Number(window.readBigUInt64LE(locator + 8));
    const zip64 = Buffer.alloc(56);
    await handle.read(zip64, 0, 56, zip64Offset);
    if (zip64.readUInt32LE(0) !== ZIP64_EOCD_SIGNATURE) return null;

    return Number(zip64.readBigUInt64LE(32));
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}
