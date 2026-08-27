import type { UploadRecord } from '../hooks/useUploads';
import { formatBytes, formatRelative } from '../lib/format';
import { BellIcon, CloseIcon } from './Icons';

interface Props {
  history: UploadRecord[];
  unseenCount: number;
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
}

const STATUS_STYLE: Record<UploadRecord['status'], { label: string; className: string }> = {
  done: { label: 'Uploaded', className: 'text-[var(--success)]' },
  failed: { label: 'Failed', className: 'text-[var(--danger)]' },
  cancelled: { label: 'Cancelled', className: 'text-[var(--text-muted)]' },
};

function HistoryRow({ record }: { record: UploadRecord }) {
  const status = STATUS_STYLE[record.status];

  return (
    <li className="flex items-start gap-2.5 px-3.5 py-2.5">
      <span
        aria-hidden="true"
        className={[
          'mt-1.5 size-1.5 shrink-0 rounded-full',
          record.status === 'done'
            ? 'bg-[var(--success)]'
            : record.status === 'failed'
              ? 'bg-[var(--danger)]'
              : 'bg-[var(--text-faint)]',
        ].join(' ')}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px]" title={record.name}>
          {record.name}
        </div>
        <div className="mt-0.5 truncate text-[10.5px] text-[var(--text-muted)]">
          <span className={status.className}>{status.label}</span>
          {' · '}
          {formatBytes(record.size)}
          {' · '}
          {record.targetPath ? record.targetPath : 'Shared Files'}
        </div>
        {record.error && (
          <div className="mt-0.5 text-[10.5px] text-[var(--danger)]">{record.error}</div>
        )}
      </div>
      <span className="shrink-0 pt-0.5 text-[10.5px] text-[var(--text-faint)]">
        {formatRelative(record.finishedAt)}
      </span>
    </li>
  );
}

/**
 * The history panel. The transfer toast is deliberately short-lived, so this
 * is where an upload you missed — or one that failed while you were in another
 * folder — stays findable. Opened by the bell in the status bar.
 */
export function NotificationPanel({ history, open, onToggle, onClear }: Omit<Props, 'unseenCount'>) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Upload history"
      // Anchored just above the status bar the bell sits in.
      className="animate-sheet fixed right-3 z-40 flex max-h-[min(26rem,60vh)] w-[min(21rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_12px_34px_rgba(0,0,0,0.18)]"
      style={{ bottom: 'calc(max(0.5rem, env(safe-area-inset-bottom)) + 2.5rem)' }}
    >
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3.5 py-2.5">
        <span className="text-[12.5px] font-semibold">Uploads</span>
        <span className="text-[11.5px] text-[var(--text-muted)]">{history.length}</span>
        <div className="flex-1" />
        {history.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11.5px] font-semibold text-[var(--accent)]"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label="Close upload history"
          className="text-[var(--text-faint)] hover:text-[var(--text)]"
        >
          <CloseIcon size={15} />
        </button>
      </div>

      {history.length === 0 ? (
        <p className="px-3.5 py-6 text-center text-[12px] text-[var(--text-muted)]">
          Nothing uploaded yet.
        </p>
      ) : (
        <ul className="scroll-pane divide-y divide-[var(--border-subtle)]">
          {history.map((record) => (
            <HistoryRow key={record.id} record={record} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The bell itself, sized to sit inline in the status bar next to the disk
 * gauge rather than floating over the gallery.
 */
export function NotificationBell({
  unseenCount,
  open,
  onToggle,
}: Pick<Props, 'unseenCount' | 'open' | 'onToggle'>) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={unseenCount > 0 ? `Upload history, ${unseenCount} new` : 'Upload history'}
      className={[
        'relative flex size-6 shrink-0 items-center justify-center rounded-md transition-colors',
        open
          ? 'bg-[var(--accent)] text-white'
          : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]',
      ].join(' ')}
    >
      <BellIcon size={15} />
      {unseenCount > 0 && !open && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex min-w-[0.95rem] items-center justify-center rounded-full bg-[var(--danger)] px-[3px] text-[9px] font-bold leading-[0.95rem] text-white"
        >
          {unseenCount > 99 ? '99+' : unseenCount}
        </span>
      )}
    </button>
  );
}
