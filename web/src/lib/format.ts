import type { Category } from './types';

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

/** Base-1000 sizes, matching what macOS and iOS report. */
export function formatBytes(bytes: number, precision?: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1000) return `${Math.round(bytes)} B`;

  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }

  const digits = precision ?? (value < 10 ? 1 : 0);
  return `${value.toFixed(digits)} ${UNITS[unit]}`;
}

export function formatRate(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '—';
  return `${formatBytes(bytesPerSecond, 0)}/s`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m left`;
  return `${Math.round(seconds / 3600)}h left`;
}

const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const timeOnly = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** Times today, day+month this year, full date otherwise — Finder's rule. */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) return timeOnly.format(date);
  if (date.getFullYear() === now.getFullYear()) return shortDate.format(date);
  return longDate.format(date);
}

/** "just now" / "12m ago" / "3h ago", falling back to a date past a day. */
export function formatRelative(timestamp: number): string {
  const seconds = Math.max(0, (Date.now() - timestamp) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return formatDate(timestamp);
}

export function formatFullDate(timestamp: number): string {
  return `${longDate.format(new Date(timestamp))}, ${timeOnly.format(new Date(timestamp))}`;
}

/** Short label under a tile: folders count items, files show a size. */
export function entrySubtitle(isDirectory: boolean, size: number, childCount: number | null): string {
  if (!isDirectory) return formatBytes(size);
  if (childCount === null) return '—';
  return childCount === 1 ? '1 item' : `${childCount} items`;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  folder: 'Folders',
  image: 'Images',
  video: 'Video',
  audio: 'Audio',
  document: 'Documents',
  spreadsheet: 'Spreadsheets',
  presentation: 'Presentations',
  archive: 'Archives',
  code: 'Code',
  text: 'Text',
  data: 'Data',
  ebook: 'E-books',
  font: 'Fonts',
  design: 'Design',
  disk: 'Disk images',
  executable: 'Apps',
  other: 'Other',
};

/**
 * Tile badge text for files without a thumbnail. Uses the real extension where
 * there is one, since "TAR.GZ" tells you more than "Archive".
 */
export function badgeText(name: string, category: Category): string {
  if (category === 'folder') return '';
  const lower = name.toLowerCase();
  for (const compound of ['.tar.gz', '.tar.bz2', '.tar.xz', '.tar.zst']) {
    if (lower.endsWith(compound)) return compound.slice(1).toUpperCase();
  }
  const dot = name.lastIndexOf('.');
  if (dot > 0 && dot < name.length - 1) {
    const extension = name.slice(dot + 1).toUpperCase();
    return extension.length <= 6 ? extension : extension.slice(0, 6);
  }
  return CATEGORY_LABELS[category].toUpperCase().slice(0, 6);
}
