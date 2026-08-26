import type { Transfer } from '../hooks/useUploads';
import { formatBytes, formatDuration, formatRate } from '../lib/format';
import { CloseIcon } from './Icons';

interface Props {
  transfers: Transfer[];
  onCancel: (id: string) => void;
  onCancelAll: () => void;
  onClear: () => void;
}

function TransferRow({ transfer, onCancel }: { transfer: Transfer; onCancel: (id: string) => void }) {
  const percent = transfer.size > 0 ? Math.min(100, (transfer.loaded / transfer.size) * 100) : 0;

  const statusLabel =
    transfer.status === 'done'
      ? 'Done'
      : transfer.status === 'failed'
        ? 'Failed'
        : transfer.status === 'cancelled'
          ? 'Cancelled'
          : transfer.status === 'queued'
            ? 'Queued'
            : `${Math.round(percent)}%`;

  const statusColor =
    transfer.status === 'done'
      ? 'text-[var(--success)]'
      : transfer.status === 'failed'
        ? 'text-[var(--danger)]'
        : 'text-[var(--text-muted)]';

  return (
    <li>
      <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
        <span className="min-w-0 truncate" title={transfer.name}>
          {transfer.name}
        </span>
        <span className={`shrink-0 font-medium ${statusColor}`}>{statusLabel}</span>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <div
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Uploading ${transfer.name}`}
          className="h-[5px] flex-1 overflow-hidden rounded-full bg-[var(--placeholder)]"
        >
          <div
            className={[
              'h-full rounded-full transition-[width] duration-200',
              transfer.status === 'done'
                ? 'bg-[var(--success)]'
                : transfer.status === 'failed' || transfer.status === 'cancelled'
                  ? 'bg-[var(--danger)]'
                  : 'bg-[var(--accent)]',
            ].join(' ')}
            style={{ width: `${transfer.status === 'done' ? 100 : percent}%` }}
          />
        </div>

        {(transfer.status === 'uploading' || transfer.status === 'queued') && (
          <button
            type="button"
            onClick={() => onCancel(transfer.id)}
            aria-label={`Cancel upload of ${transfer.name}`}
            className="shrink-0 text-[var(--text-faint)] hover:text-[var(--danger)]"
          >
            <CloseIcon size={13} />
          </button>
        )}
      </div>

      <div className="mt-1 text-[10.5px] text-[var(--text-muted)]">
        {transfer.status === 'uploading' ? (
          <>
            {formatBytes(transfer.size)} · {formatRate(transfer.bytesPerSecond)} ·{' '}
            {formatDuration(transfer.secondsRemaining)}
          </>
        ) : transfer.status === 'failed' ? (
          <span className="text-[var(--danger)]">{transfer.error}</span>
        ) : (
          formatBytes(transfer.size)
        )}
      </div>
    </li>
  );
}

/**
 * The mockup puts the queue in the inspector column. Here it is a floating
 * card instead, so the inspector can stay on whatever file you selected while
 * a long upload runs — and so the same component works on a phone.
 */
export function TransferPanel({ transfers, onCancel, onCancelAll, onClear }: Props) {
  if (transfers.length === 0) return null;

  const active = transfers.filter((t) => t.status === 'uploading' || t.status === 'queued');
  const done = transfers.filter((t) => t.status === 'done').length;

  return (
    <div
      className="animate-sheet fixed right-3 z-30 w-[min(19rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_12px_34px_rgba(0,0,0,0.18)]"
      style={{ bottom: 'max(0.75rem, calc(env(safe-area-inset-bottom) + 0.75rem))' }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-baseline gap-2 border-b border-[var(--border-subtle)] px-3.5 py-2.5">
        <span className="text-[12.5px] font-semibold">
          {active.length > 0 ? 'Uploading' : 'Uploads'}
        </span>
        <span className="text-[11.5px] text-[var(--text-muted)]">
          {done} of {transfers.length}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={active.length > 0 ? onCancelAll : onClear}
          className="text-[11.5px] font-semibold text-[var(--accent)]"
        >
          {active.length > 0 ? 'Cancel all' : 'Clear'}
        </button>
      </div>

      <ul className="scroll-pane grid max-h-64 gap-3 p-3.5">
        {transfers.map((transfer) => (
          <TransferRow key={transfer.id} transfer={transfer} onCancel={onCancel} />
        ))}
      </ul>
    </div>
  );
}
