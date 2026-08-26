import { useEffect, useRef, useState } from 'react';

interface Props {
  title: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({
  title,
  label,
  placeholder,
  confirmLabel,
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const trimmed = value.trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onCancel}
        className="animate-fade absolute inset-0 cursor-default bg-black/25"
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed) onConfirm(trimmed);
        }}
        className="animate-sheet relative w-full max-w-[22rem] rounded-2xl bg-[var(--surface)] p-5 shadow-[var(--shadow-sheet)]"
      >
        <h2 id="prompt-title" className="text-[15px] font-semibold">
          {title}
        </h2>

        <label className="mt-3 block text-[12px] text-[var(--text-muted)]">
          {label}
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-2 text-[16px] text-[var(--text)] outline-none focus:border-[var(--accent)] sm:text-[13px]"
          />
        </label>

        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 flex-1 rounded-[10px] bg-[var(--surface-hover)] text-[13px] font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!trimmed}
            className="h-10 flex-1 rounded-[10px] bg-[var(--accent)] text-[13px] font-semibold text-white disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
