import { config as loadDotenv } from 'dotenv';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

loadDotenv({ path: path.join(repoRoot, '.env') });

/** Expand a leading `~` and resolve to an absolute path. */
function resolveHome(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '~') return os.homedir();
  if (trimmed.startsWith('~/')) return path.join(os.homedir(), trimmed.slice(2));
  return path.resolve(trimmed);
}

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? fallback : raw;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number, got "${raw}"`);
  }
  return Math.floor(parsed);
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

/** Parse a comma-separated allowlist into lowercased entries. */
function list(name: string): string[] {
  return str(name, '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

const authMode = str('AUTH_MODE', 'tailscale').toLowerCase();
if (authMode !== 'tailscale' && authMode !== 'none') {
  throw new Error(`AUTH_MODE must be "tailscale" or "none", got "${authMode}"`);
}

const shareRoot = resolveHome(str('SHARE_ROOT', '~/Documents/SharedFiles'));
const dataDir = resolveHome(str('DATA_DIR', '~/.local/share/fileshare'));

// The cache must not live inside the library, or its own files would show up
// in the gallery and be uploadable/deletable through the API.
const relativeToShare = path.relative(shareRoot, dataDir);
if (relativeToShare !== '' && !relativeToShare.startsWith('..') && !path.isAbsolute(relativeToShare)) {
  throw new Error(`DATA_DIR (${dataDir}) must not live inside SHARE_ROOT (${shareRoot})`);
}

fs.mkdirSync(shareRoot, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

export const config = {
  host: str('HOST', '127.0.0.1'),
  port: int('PORT', 8080),
  isProduction: str('NODE_ENV', 'development') === 'production',

  shareRoot,
  dataDir,
  thumbnailDir: path.join(dataDir, 'thumbnails'),
  databasePath: path.join(dataDir, 'index.sqlite'),

  maxUploadBytes: int('MAX_UPLOAD_BYTES', 8 * 1024 ** 3),
  maxHashBytes: int('MAX_HASH_BYTES', 2 * 1024 ** 3),

  authMode: authMode as 'tailscale' | 'none',
  allowedUsers: list('ALLOWED_USERS'),
  writeUsers: list('WRITE_USERS'),

  enableVideoThumbnails: bool('ENABLE_VIDEO_THUMBNAILS', true),
  ffmpegPath: str('FFMPEG_PATH', 'ffmpeg'),
  thumbnailSize: int('THUMBNAIL_SIZE', 480),

  webDist: path.join(repoRoot, 'web', 'dist'),
} as const;

fs.mkdirSync(config.thumbnailDir, { recursive: true });
