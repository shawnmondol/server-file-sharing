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
 * The bell in the corner and the panel it opens. The transfer toast is
 * deliberately short-lived, so this is where an upload you missed — or one
 * that failed while you were in another folder — stays findable.
 */
export function NotificationCenter({ history, unseenCount, open, onToggle, onClear }: Props) {
  // Sits clear of the status bar rather than on top of the disk gauge.
  const bottom = 'calc(max(0.5rem, env(safe-area-inset-bottom)) + 2.75rem)';

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Upload history"
          className="animate-sheet fixed right-3 z-40 flex max-h-[min(26rem,60vh)] w-[min(21rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_12px_34px_rgba(0,0,0,0.18)]"
          style={{ bottom: `calc(${bottom} + 3.5rem)` }}
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
      )}

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={
          unseenCount > 0
            ? `Upload history, ${unseenCount} new`
            : 'Upload history'
        }
        className={[
          'fixed right-3 z-40 flex size-11 items-center justify-center rounded-full border shadow-[0_6px_20px_rgba(0,0,0,0.16)] transition-colors',
          open
            ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]',
        ].join(' ')}
        style={{ bottom }}
      >
        <BellIcon size={19} />
        {unseenCount > 0 && !open && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[1.15rem] items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold leading-[1.15rem] text-white">
            {unseenCount > 99 ? '99+' : unseenCount}
          </span>
        )}
      </button>
    </>
  );
}
