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

type DetailsProps = Pick<Props, 'entry' | 'details' | 'detailsLoading' | 'onPreview'>;
type ActionProps = Pick<Props, 'entry' | 'canWrite' | 'online' | 'onDownload' | 'onDelete'>;

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

/**
 * Everything about the file. This is the part that scrolls: the metadata grows
 * with the file — a long path, a SHA-256, an archive entry count — and there is
 * no upper bound on how tall it gets.
 */
function InspectorDetails({ entry, details, detailsLoading, onPreview }: DetailsProps) {
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
    </>
  );
}

/**
 * Download and delete. Pinned rather than scrolled: these are why the panel is
 * open, and they should not drift below the fold just because the file happens
 * to have a long path or a digest.
 */
function InspectorActions({ entry, canWrite, online, onDownload, onDelete }: ActionProps) {
  return (
    <div className="flex gap-2">
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
  );
}

function InspectorPlaceholder({ selectedCount }: { selectedCount: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
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
  canWrite,
  online,
  onDownload,
  onDelete,
  ...details
}: Omit<Props, 'entry'> & { entry: Entry | null; selectedCount: number }) {
  return (
    <aside className="hidden w-[264px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface-raised)] lg:flex">
      {entry ? (
        <>
          <div className="scroll-pane min-h-0 flex-1 p-4">
            <InspectorDetails entry={entry} {...details} />
          </div>
          <div className="shrink-0 border-t border-[var(--border-subtle)] p-3">
            <InspectorActions
              entry={entry}
              canWrite={canWrite}
              online={online}
              onDownload={onDownload}
              onDelete={onDelete}
            />
          </div>
        </>
      ) : (
        <InspectorPlaceholder selectedCount={selectedCount} />
      )}
    </aside>
  );
}

/** Phone: the same content in a sheet that slides up over the grid. */
export function InspectorSheet({
  canWrite,
  online,
  onDownload,
  onDelete,
  onClose,
  ...details
}: Props) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-black/25"
      />
      <div className="animate-sheet relative flex max-h-[82vh] flex-col rounded-t-2xl border-t border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sheet)]">
        <div className="shrink-0 pt-2.5">
          <span
            className="mx-auto block h-1 w-9 rounded-full bg-[var(--border)]"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-muted)]"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="scroll-pane min-h-0 flex-1 px-4 pb-3 pt-2">
          <InspectorDetails {...details} />
        </div>

        <div
          className="shrink-0 border-t border-[var(--border-subtle)] px-4 pt-3"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <InspectorActions
            entry={details.entry}
            canWrite={canWrite}
            online={online}
            onDownload={onDownload}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}
