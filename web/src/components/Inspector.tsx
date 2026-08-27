import { previewUrl, thumbnailUrl } from '../lib/api';
import { formatBytes, formatFullDate } from '../lib/format';
import type { Details, Entry } from '../lib/types';
import { CategoryIcon, CloseIcon, ContainerIcon, DownloadIcon, isContainer, TrashIcon } from './Icons';

interface Props {
  entry: Entry;
  details: Details | null;
  detailsLoading: boolean;
  canWrite: boolean;
  online: boolean;
  onDownload: () => void;
  onDelete: () => void;
  onPreview: () => void;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-[12px]">
      <span className="shrink-0 text-[var(--text-muted)]">{label}</span>
      <span className="min-w-0 truncate text-right" title={value}>
        {value}
      </span>
    </div>
  );
}

export function InspectorBody({
  entry,
  details,
  detailsLoading,
  canWrite,
  online,
  onDownload,
  onDelete,
  onPreview,
}: Omit<Props, 'onClose'>) {
  // The server decides which files have a viewer at all.
  const previewable = entry.preview !== null;

  return (
    <>
      <button
        type="button"
        onClick={onPreview}
        disabled={!previewable}
        aria-label={previewable ? `Preview ${entry.name}` : undefined}
        className={[
          'flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl text-[var(--text-muted)] disabled:cursor-default',
          // A container's glyph carries its own colour and needs no backdrop.
          isContainer(entry) ? '' : 'bg-[var(--placeholder)]',
        ].join(' ')}
      >
        {isContainer(entry) ? (
          <ContainerIcon entry={entry} className="h-auto w-[42%]" />
        ) : entry.hasThumbnail ? (
          <img
            src={entry.category === 'image' ? previewUrl(entry.path) : thumbnailUrl(entry.path)}
            alt=""
            className="size-full object-contain"
          />
        ) : (
          <CategoryIcon category={entry.category} size={44} />
        )}
      </button>

      <h2 className="mt-3 break-all text-[14px] font-semibold leading-snug">{entry.name}</h2>

      <div className="mt-2 divide-y divide-[var(--border-subtle)]">
        <Row
          label={entry.isDirectory ? 'Items' : 'Size'}
          value={
            entry.isDirectory
              ? String(details?.childCount ?? entry.childCount ?? '—')
              : formatBytes(entry.size)
          }
        />
        {entry.isDirectory && details?.totalBytes !== undefined && (
          <Row label="Contents" value={formatBytes(details.totalBytes)} />
        )}
        <Row label="Kind" value={entry.kind} />
        <Row label="Added" value={formatFullDate(entry.addedAt)} />
        <Row label="Modified" value={formatFullDate(entry.modifiedAt)} />
        <Row label="Owner" value={`${entry.owner} · ${entry.mode}`} />
        {details?.archiveEntries != null && (
          <Row label="Entries" value={details.archiveEntries.toLocaleString()} />
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="break-all rounded-lg bg-[var(--surface-sunken)] px-2.5 py-2 text-[11px] text-[var(--text-muted)]">
          /{entry.path}
        </div>
        {!entry.isDirectory && (
          <div className="break-all rounded-lg bg-[var(--surface-sunken)] px-2.5 py-2 font-mono text-[10.5px] text-[var(--text-muted)]">
            {detailsLoading
              ? 'SHA-256 …'
              : details?.sha256
                ? `SHA-256 ${details.sha256}`
                : 'SHA-256 not computed for files this large'}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onDownload}
          disabled={!online}
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[var(--accent)] text-[13px] font-semibold text-white disabled:opacity-40"
        >
          <DownloadIcon size={16} />
          Download
        </button>
        {canWrite && (
          <button
            type="button"
            onClick={onDelete}
            disabled={!online}
            aria-label={`Delete ${entry.name}`}
            className="flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-[13px] font-semibold text-[var(--danger)] disabled:opacity-40"
          >
            <TrashIcon size={16} />
          </button>
        )}
      </div>
    </>
  );
}

function InspectorPlaceholder({ selectedCount }: { selectedCount: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--surface-hover)] text-[var(--text-faint)]">
        <CategoryIcon category="other" size={22} />
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
        {selectedCount > 1
          ? `${selectedCount} items selected`
          : 'Select a file to see its details'}
      </p>
    </div>
  );
}

/**
 * Desktop: a Finder-style column pinned to the right of the gallery.
 *
 * The column is always present, even with nothing selected. It used to mount
 * on selection, which narrowed the gallery and reflowed the grid between the
 * two halves of a double-click — so the second click landed on whichever tile
 * had slid under the pointer, and the wrong file opened.
 */
export function InspectorSidebar({
  entry,
  selectedCount,
  ...rest
}: Omit<Props, 'entry'> & { entry: Entry | null; selectedCount: number }) {
  return (
    <aside className="scroll-pane hidden w-[264px] shrink-0 border-l border-[var(--border)] bg-[var(--surface-raised)] p-4 lg:block">
      {entry ? (
        <InspectorBody entry={entry} {...rest} />
      ) : (
        <InspectorPlaceholder selectedCount={selectedCount} />
      )}
    </aside>
  );
}

/** Phone: the same content in a sheet that slides up over the grid. */
export function InspectorSheet(props: Props) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close details"
        onClick={props.onClose}
        className="animate-fade absolute inset-0 bg-black/25"
      />
      <div
        className="animate-sheet scroll-pane relative max-h-[82vh] rounded-t-2xl border-t border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sheet)]"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="mx-auto h-1 w-9 rounded-full bg-[var(--border)]" aria-hidden="true" />
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close details"
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-muted)]"
          >
            <CloseIcon size={16} />
          </button>
        </div>
        <InspectorBody {...props} />
      </div>
    </div>
  );
}
