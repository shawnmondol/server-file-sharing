import { useCallback, useEffect, useState } from 'react';
import { downloadUrl, previewUrl } from '../lib/api';
import { formatBytes } from '../lib/format';
import type { Entry } from '../lib/types';
import { ConfirmDialog } from './ConfirmDialog';
import { CloseIcon, DownloadIcon } from './Icons';
import { TextViewer } from './TextViewer';

interface Props {
  entry: Entry;
  canWrite: boolean;
  online: boolean;
  onSaved: () => void;
  onClose: () => void;
}

/**
 * Quick Look–style overlay. Images and video play inline, PDFs render in the
 * browser's own viewer, and anything the server will serve as text opens in
 * the editor. Everything else never reaches here — it downloads instead.
 */
export function PreviewOverlay({ entry, canWrite, online, onSaved, onClose }: Props) {
  const [dirty, setDirty] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // Closing with unsaved edits would silently throw them away, so the text
  // editor's dirty flag gates both exit routes — Escape and the ✕.
  const requestClose = useCallback(() => {
    if (dirty) setConfirmingDiscard(true);
    else onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // While the discard prompt is up it owns Escape, or the two handlers
      // would cancel and immediately re-open it.
      if (event.key === 'Escape' && !confirmingDiscard) requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmingDiscard, requestClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${entry.name}`}
      className="animate-fade fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm"
    >
      <div
        className="flex items-center gap-3 px-4 pb-3 text-white"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{entry.name}</div>
          <div className="text-[11px] text-white/60">
            {entry.kind} · {formatBytes(entry.size)}
          </div>
        </div>

        <a
          href={downloadUrl(entry.path)}
          className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white"
          aria-label={`Download ${entry.name}`}
        >
          <DownloadIcon size={17} />
        </a>
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close preview"
          className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white"
        >
          <CloseIcon size={17} />
        </button>
      </div>

      <div
        className="flex min-h-0 flex-1 items-center justify-center p-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {entry.preview === 'video' ? (
          <video
            src={previewUrl(entry.path)}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full rounded-lg"
          />
        ) : entry.preview === 'pdf' ? (
          // The browser's built-in PDF viewer handles paging, zoom, and text
          // selection far better than anything worth shipping here would.
          <iframe
            src={previewUrl(entry.path)}
            title={`${entry.name} preview`}
            className="size-full rounded-lg border-0 bg-white"
          />
        ) : entry.preview === 'text' ? (
          <TextViewer
            entry={entry}
            canWrite={canWrite}
            online={online}
            onDirtyChange={setDirty}
            onSaved={onSaved}
          />
        ) : (
          <img
            src={previewUrl(entry.path)}
            alt={entry.name}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        )}
      </div>

      {confirmingDiscard && (
        <ConfirmDialog
          title="Discard your changes?"
          body={`Your edits to “${entry.name}” have not been saved. Closing now loses them.`}
          confirmLabel="Discard"
          busy={false}
          onConfirm={onClose}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </div>
  );
}
