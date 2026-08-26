import { UploadIcon } from './Icons';

interface Props {
  query: string;
  category: string;
  categoryLabel: string;
  canUpload: boolean;
  onClearFilter: () => void;
  onClearSearch: () => void;
  onUpload: () => void;
}

export function EmptyState({
  query,
  category,
  categoryLabel,
  canUpload,
  onClearFilter,
  onClearSearch,
  onUpload,
}: Props) {
  const filtered = category !== 'all';

  // Three distinct dead ends, each with the action that actually resolves it.
  if (query || filtered) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h2 className="text-[14px] font-semibold">No matches</h2>
        <p className="mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-[var(--text-muted)]">
          {query && filtered
            ? `Nothing named “${query}” is in ${categoryLabel}.`
            : query
              ? `Nothing here is named “${query}”.`
              : `This folder has nothing in ${categoryLabel}.`}
        </p>
        <button
          type="button"
          onClick={filtered ? onClearFilter : onClearSearch}
          className="mt-3.5 rounded-lg bg-[var(--surface-hover)] px-3.5 py-2 text-[12px] font-semibold text-[var(--accent)]"
        >
          {filtered ? 'Clear the type filter' : 'Clear the search'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--surface-hover)] text-[var(--text-muted)]">
        <UploadIcon size={24} />
      </div>
      <h2 className="mt-3 text-[14px] font-semibold">This folder is empty</h2>
      <p className="mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-[var(--text-muted)]">
        {canUpload
          ? 'Drop files anywhere on this window, or use the Upload button.'
          : 'Nothing has been shared here yet.'}
      </p>
      {canUpload && (
        <button
          type="button"
          onClick={onUpload}
          className="mt-3.5 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[12px] font-semibold text-white"
        >
          Upload files
        </button>
      )}
    </div>
  );
}
