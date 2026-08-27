import type { ReactNode } from 'react';
import { formatBytes } from '../lib/format';
import type { DiskUsage } from '../lib/types';

interface Props {
  itemCount: number;
  totalBytes: number;
  disk: DiskUsage;
  /** Rendered at the far right, after the disk gauge. */
  trailing?: ReactNode;
}

export function StatusBar({ itemCount, totalBytes, disk, trailing }: Props) {
  const usedFraction = disk.totalBytes > 0 ? disk.usedBytes / disk.totalBytes : 0;

  return (
    <footer
      className="flex items-center gap-2.5 border-t border-[var(--border)] bg-[var(--surface-raised)] py-1.5 pl-4 pr-2.5 text-[11px] text-[var(--text-muted)]"
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

      {trailing && (
        <>
          <span
            aria-hidden="true"
            className="h-3.5 w-px shrink-0 bg-[var(--border)]"
          />
          {trailing}
        </>
      )}
    </footer>
  );
}
