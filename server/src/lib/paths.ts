import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

export class PathError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
    this.name = 'PathError';
  }
}

/** `realpath` of the share root, resolved once so symlink checks are cheap. */
const realShareRoot = await fs.realpath(config.shareRoot);

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/** Reject anything that cannot be a single, well-behaved path segment. */
export function assertSafeSegment(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new PathError('Name cannot be empty');
  if (trimmed === '.' || trimmed === '..') throw new PathError('Invalid name');
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    throw new PathError('Name cannot contain path separators');
  }
  // NUL and other control characters are never legitimate in a filename and
  // can truncate the path once it reaches a syscall.
  if (CONTROL_CHARS.test(trimmed)) {
    throw new PathError('Name contains control characters');
  }
  if (Buffer.byteLength(trimmed) > 255) throw new PathError('Name is too long');
  return trimmed;
}

/**
 * Normalise a client-supplied relative path into a canonical form:
 * forward slashes, no leading slash, no `.` or `..` segments.
 */
export function normalizeRelative(input: string | undefined | null): string {
  if (!input) return '';
  const unified = input.replace(/\\/g, '/');
  const segments: string[] = [];
  for (const raw of unified.split('/')) {
    if (raw === '' || raw === '.') continue;
    if (raw === '..') throw new PathError('Path traversal is not allowed');
    segments.push(assertSafeSegment(raw));
  }
  return segments.join('/');
}

/** Absolute on-disk location for a client-supplied relative path. */
export function toAbsolute(relative: string): string {
  const normalized = normalizeRelative(relative);
  return normalized ? path.join(config.shareRoot, normalized) : config.shareRoot;
}

/** Relative-to-share form of an absolute path, using forward slashes. */
export function toRelative(absolute: string): string {
  const rel = path.relative(config.shareRoot, absolute);
  return rel.split(path.sep).join('/');
}

function isInsideRoot(candidate: string): boolean {
  const rel = path.relative(realShareRoot, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Resolve an existing path and confirm it is genuinely inside the share root.
 *
 * `normalizeRelative` already rejects `..`, but a symlink inside the library
 * can still point outside it. Comparing the realpath closes that gap.
 */
export async function resolveExisting(relative: string): Promise<string> {
  const absolute = toAbsolute(relative);
  let real: string;
  try {
    real = await fs.realpath(absolute);
  } catch {
    throw new PathError('No such file or folder', 404);
  }
  if (!isInsideRoot(real)) {
    throw new PathError('No such file or folder', 404);
  }
  return absolute;
}

/**
 * Resolve a path that does not exist yet (an upload target, a new folder) by
 * validating its parent directory instead.
 */
export async function resolveNew(parentRelative: string, name: string): Promise<string> {
  const safeName = assertSafeSegment(name);
  const parentAbsolute = await resolveExisting(parentRelative);
  const parentStat = await fs.stat(parentAbsolute);
  if (!parentStat.isDirectory()) {
    throw new PathError('Destination is not a folder');
  }
  return path.join(parentAbsolute, safeName);
}

/**
 * Pick a name that does not collide with an existing entry by appending
 * ` (2)`, ` (3)`, … before the extension — the behaviour people expect from a
 * file manager, and safer than silently overwriting an upload.
 */
export async function findAvailableName(directory: string, desired: string): Promise<string> {
  const extension = path.extname(desired);
  const stem = desired.slice(0, desired.length - extension.length);
  for (let attempt = 1; attempt < 1000; attempt += 1) {
    const candidate = attempt === 1 ? desired : `${stem} (${attempt})${extension}`;
    try {
      await fs.access(path.join(directory, candidate));
    } catch {
      return candidate;
    }
  }
  throw new PathError('Could not find an available filename');
}
