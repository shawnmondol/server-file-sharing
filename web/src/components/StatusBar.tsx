import { formatBytes } from '../lib/format';
import type { DiskUsage } from '../lib/types';

interface Props {
  itemCount: number;
  totalBytes: number;
  disk: DiskUsage;
}

export function StatusBar({ itemCount, totalBytes, disk }: Props) {
  const usedFraction = disk.totalBytes > 0 ? disk.usedBytes / disk.totalBytes : 0;

  return (
    <footer
      className="flex items-center gap-3 border-t border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2 text-[11px] text-[var(--text-muted)]"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <span className="shrink-0">
        {itemCount.toLocaleString()} {itemCount === 1 ? 'item' : 'items'}
        <span className="hidden sm:inline"> · {formatBytes(totalBytes)}</span>
      </span>

      <div className="flex-1" />

      <div className="flex shrink-0 items-center gap-2">
        <div
          className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--placeholder)]"
          role="img"
          aria-label={`Disk ${Math.round(usedFraction * 100)} percent full`}
        >
          <div
            className={usedFraction > 0.9 ? 'h-full bg-[var(--danger)]' : 'h-full bg-[var(--accent)]'}
            style={{ width: `${Math.min(100, usedFraction * 100)}%` }}
          />
        </div>
        <span>
          {formatBytes(disk.usedBytes)} of {formatBytes(disk.totalBytes)}
        </span>
      </div>
    </footer>
  );
}
