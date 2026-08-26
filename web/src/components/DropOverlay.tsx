import { formatBytes } from '../lib/format';
import { UploadIcon } from './Icons';

interface Props {
  folderName: string;
  maxUploadBytes: number;
  freeBytes: number;
}

export function DropOverlay({ folderName, maxUploadBytes, freeBytes }: Props) {
  return (
    <div className="animate-fade pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))]">
      <UploadIcon size={28} className="text-[var(--accent)]" />
      <p className="text-[14px] font-semibold text-[var(--accent)]">Drop to upload to {folderName}</p>
      <p className="text-[11.5px] text-[var(--text-muted)]">
        Max {formatBytes(maxUploadBytes)} per file · {formatBytes(freeBytes)} free
      </p>
    </div>
  );
}
