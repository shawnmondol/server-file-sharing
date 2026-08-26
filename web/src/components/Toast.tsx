import { useEffect } from 'react';
import { CloseIcon } from './Icons';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'error' | 'info';
}

interface Props {
  toast: ToastMessage;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 6000;

export function Toast({ toast, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // Re-arm whenever a new message replaces the current one.
  }, [toast.id, onDismiss]);

  return (
    <div
      role="alert"
      className="animate-sheet fixed left-1/2 z-50 flex w-[min(24rem,calc(100vw-1.5rem))] -translate-x-1/2 items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 shadow-[0_12px_34px_rgba(0,0,0,0.18)]"
      style={{ top: 'max(0.75rem, calc(env(safe-area-inset-top) + 0.5rem))' }}
    >
      <span
        aria-hidden="true"
        className={[
          'mt-1 size-2 shrink-0 rounded-full',
          toast.tone === 'error' ? 'bg-[var(--danger)]' : 'bg-[var(--accent)]',
        ].join(' ')}
      />
      <p className="flex-1 text-[12.5px] leading-relaxed">{toast.text}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-[var(--text-faint)] hover:text-[var(--text)]"
      >
        <CloseIcon size={15} />
      </button>
    </div>
  );
}
