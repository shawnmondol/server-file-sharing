import { RetryIcon } from './Icons';

interface Props {
  hostname: string;
  onRetry: () => void;
}

export function OfflineBanner({ hostname, onRetry }: Props) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-2.5 text-[11.5px] leading-relaxed text-[var(--warning-text)]"
    >
      <p className="flex-1">
        Lost the tailnet connection to {hostname || 'the server'}. Showing the last known list —
        uploads and deletes are paused.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-[11.5px] font-semibold text-white"
      >
        <RetryIcon size={14} />
        Retry
      </button>
    </div>
  );
}
