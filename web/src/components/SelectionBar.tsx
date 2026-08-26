import { formatBytes } from '../lib/format';
import { DownloadIcon, TrashIcon } from './Icons';

interface Props {
  count: number;
  bytes: number;
  canWrite: boolean;
  online: boolean;
  busy: boolean;
  onDownload: () => void;
  onDelete: () => void;
  onDeselect: () => void;
}

export function SelectionBar({
  count,
  bytes,
  canWrite,
  online,
  busy,
  onDownload,
  onDelete,
  onDeselect,
}: Props) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--accent-soft)] px-3 py-2 sm:px-4">
      <span className="shrink-0 text-[12.5px] font-semibold text-[var(--accent)]">
        {count} selected
        <span className="hidden sm:inline"> · {formatBytes(bytes)}</span>
      </span>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onDownload}
        disabled={!online || busy}
        className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-2.5 text-[11.5px] font-semibold text-white disabled:opacity-40"
      >
        <DownloadIcon size={14} />
        {busy ? 'Preparing…' : <span className="hidden sm:inline">Download as .zip</span>}
        <span className="sm:hidden">.zip</span>
      </button>

      {canWrite && (
        <button
          type="button"
          onClick={onDelete}
          disabled={!online || busy}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[11.5px] font-semibold text-[var(--danger)] disabled:opacity-40"
        >
          <TrashIcon size={14} />
          <span className="hidden sm:inline">Delete</span>
        </button>
      )}

      <button
        type="button"
        onClick={onDeselect}
        className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[11.5px] font-semibold"
      >
        Deselect
      </button>
    </div>
  );
}
