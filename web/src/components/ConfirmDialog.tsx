import { useEffect, useRef } from 'react';
import { TrashIcon } from './Icons';

interface Props {
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onCancel}
        className="animate-fade absolute inset-0 cursor-default bg-black/25"
      />

      <div className="animate-sheet relative w-full max-w-[22rem] rounded-2xl bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-sheet)]">
        <div
          className={[
            'mx-auto flex size-11 items-center justify-center rounded-xl',
            destructive ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[var(--accent-soft)] text-[var(--accent)]',
          ].join(' ')}
        >
          <TrashIcon size={22} />
        </div>

        <h2 id="confirm-title" className="mt-3 break-words text-[15px] font-semibold">
          {title}
        </h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{body}</p>

        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 flex-1 rounded-[10px] bg-[var(--surface-hover)] text-[13px] font-semibold"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={[
              'h-10 flex-1 rounded-[10px] text-[13px] font-semibold text-white disabled:opacity-50',
              destructive ? 'bg-[var(--danger)]' : 'bg-[var(--accent)]',
            ].join(' ')}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
