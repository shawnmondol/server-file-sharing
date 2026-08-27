import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { ApiError, getText, saveText } from '../lib/api';
import { formatBytes } from '../lib/format';
import type { Entry } from '../lib/types';

interface Props {
  entry: Entry;
  canWrite: boolean;
  online: boolean;
  /** Reports unsaved edits so the overlay can warn before it closes. */
  onDirtyChange: (dirty: boolean) => void;
  /** Fires after a successful save so the listing picks up the new size. */
  onSaved: () => void;
}

/**
 * The in-app text editor. Any file the server will hand over as text opens
 * here — notes, code, config — and, for an account with write access, saves
 * straight back to the share.
 */
export function TextViewer({ entry, canWrite, online, onDirtyChange, onSaved }: Props) {
  const [content, setContent] = useState('');
  const [original, setOriginal] = useState('');
  const [modifiedAt, setModifiedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const editable = canWrite && online && !loading && loadError === null;
  const dirty = content !== original;

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true);
      setSaveError(null);
      return getText(entry.path, signal)
        .then((document) => {
          setContent(document.content);
          setOriginal(document.content);
          setModifiedAt(document.modifiedAt);
          setLoadError(null);
          setSaved(false);
        })
        .catch((cause: unknown) => {
          if (signal?.aborted) return;
          setLoadError(cause instanceof ApiError ? cause.message : 'Could not read this file');
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [entry.path],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const save = useCallback(async () => {
    if (!editable || !dirty || saving) return;

    setSaving(true);
    setSaveError(null);
    try {
      const result = await saveText(entry.path, content, modifiedAt);
      setOriginal(content);
      setModifiedAt(result.modifiedAt);
      setSaved(true);
      onSaved();
    } catch (cause) {
      setSaveError(cause instanceof ApiError ? cause.message : 'Could not save this file');
    } finally {
      setSaving(false);
    }
  }, [content, dirty, editable, entry.path, modifiedAt, onSaved, saving]);

  // ⌘S / Ctrl-S saves, the way every other editor behaves. Bound on the
  // textarea rather than the window so it only applies while editing.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void save();
    }
    // Escape belongs to the overlay's close handler, not to the textarea.
    if (event.key === 'Tab') {
      // A literal tab is what you want in a config file; losing focus is not.
      event.preventDefault();
      const field = event.currentTarget;
      const { selectionStart, selectionEnd } = field;
      const next = `${content.slice(0, selectionStart)}\t${content.slice(selectionEnd)}`;
      setContent(next);
      requestAnimationFrame(() => {
        field.selectionStart = field.selectionEnd = selectionStart + 1;
      });
    }
  };

  const lineCount = content ? content.split('\n').length : 0;
  // Recomputed per keystroke otherwise, and the file can be megabytes.
  const byteLength = useMemo(() => new TextEncoder().encode(content).length, [content]);

  return (
    // h-full, not flex-1: the overlay centres its child on the cross axis,
    // so without an explicit height the editor shrinks to its content.
    <div className="flex h-full min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-[13px] text-[var(--text-muted)]">
          Loading…
        </div>
      ) : loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-[13px] text-[var(--text-muted)]">{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[12px] font-semibold text-white"
          >
            Try again
          </button>
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={onKeyDown}
          readOnly={!editable}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={`Contents of ${entry.name}`}
          // 16px on the phone keeps iOS Safari from zooming the viewport.
          className="scroll-pane min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-[16px] leading-relaxed outline-none sm:text-[12.5px]"
        />
      )}

      <div className="flex items-center gap-3 border-t border-[var(--border-subtle)] px-3.5 py-2.5 text-[11.5px] text-[var(--text-muted)]">
        <span className="shrink-0">
          {lineCount.toLocaleString()} {lineCount === 1 ? 'line' : 'lines'} · {formatBytes(byteLength)}
        </span>

        <div className="min-w-0 flex-1 truncate text-right">
          {saveError ? (
            <>
              <span className="text-[var(--danger)]">{saveError}</span>{' '}
              {/* A 409 means someone else changed the file; reloading is the
                  only way to see what to merge. */}
              <button
                type="button"
                onClick={() => void load()}
                className="font-semibold text-[var(--accent)] underline"
              >
                Reload
              </button>
            </>
          ) : !canWrite ? (
            'Read-only account'
          ) : !online ? (
            'Offline — saving is paused'
          ) : dirty ? (
            <span className="text-[var(--warning-text)]">Unsaved changes</span>
          ) : saved ? (
            <span className="text-[var(--success)]">Saved</span>
          ) : (
            ''
          )}
        </div>

        {editable && (
          <>
            <button
              type="button"
              onClick={() => setContent(original)}
              disabled={!dirty || saving}
              className="shrink-0 rounded-lg px-2 py-1 font-semibold text-[var(--accent)] disabled:text-[var(--text-faint)]"
            >
              Revert
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving}
              className="h-8 shrink-0 rounded-lg bg-[var(--accent)] px-3 text-[12px] font-semibold text-white disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
