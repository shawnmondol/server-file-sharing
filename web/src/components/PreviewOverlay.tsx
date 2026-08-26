import { useEffect } from 'react';
import { downloadUrl, previewUrl } from '../lib/api';
import { formatBytes } from '../lib/format';
import type { Entry } from '../lib/types';
import { CloseIcon, DownloadIcon } from './Icons';

interface Props {
  entry: Entry;
  onClose: () => void;
}

/**
 * Quick Look–style overlay from artboard 2d. Images and video only: anything
 * else is better served by downloading it than by a half-working viewer.
 */
export function PreviewOverlay({ entry, onClose }: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

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
          onClick={onClose}
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
        {entry.category === 'video' ? (
          <video
            src={previewUrl(entry.path)}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full rounded-lg"
          />
        ) : (
          <img
            src={previewUrl(entry.path)}
            alt={entry.name}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        )}
      </div>
    </div>
  );
}
