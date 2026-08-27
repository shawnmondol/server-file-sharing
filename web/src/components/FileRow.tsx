import { memo, useState } from 'react';
import { useDropTarget } from '../hooks/useDropTarget';
import { thumbnailUrl } from '../lib/api';
import { setDragPayload } from '../lib/dnd';
import { badgeText, entrySubtitle, formatBytes, formatDate } from '../lib/format';
import type { Entry } from '../lib/types';
import { CategoryIcon, CheckIcon, ContainerIcon, isContainer } from './Icons';

interface Props {
  entry: Entry;
  selected: boolean;
  showPath: boolean;
  canMove: boolean;
  dragging: boolean;
  onSelect: (entry: Entry, modifiers: { toggle: boolean; range: boolean }) => void;
  onOpen: (entry: Entry) => void;
  onDragStart: (entry: Entry) => string[];
  onDragEnd: () => void;
  onDropInto: (folder: Entry, paths: string[]) => void;
}

function RowIcon({ entry }: { entry: Entry }) {
  const [failed, setFailed] = useState(false);

  // Containers keep the same solid glyph they have in the grid, unframed.
  if (isContainer(entry)) {
    return (
      <div className="flex size-9 shrink-0 items-center justify-center">
        <ContainerIcon entry={entry} className="size-8" />
      </div>
    );
  }

  if (entry.hasThumbnail && !failed) {
    return (
      <img
        src={thumbnailUrl(entry.path)}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="size-9 shrink-0 rounded-md object-cover ring-1 ring-[var(--border-subtle)]"
      />
    );
  }

  return (
    <div className="flex size-9 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md bg-[var(--placeholder)] text-[var(--text-muted)] ring-1 ring-[var(--border-subtle)]">
      <CategoryIcon category={entry.category} size={15} />
      <span className="text-[6.5px] font-bold leading-none tracking-wide text-[var(--text-faint)]">
        {badgeText(entry.name, entry.category)}
      </span>
    </div>
  );
}

/**
 * One row of the list view. Carries exactly the same interactions as a tile —
 * click to select, double-click to open, drag to move — so switching views
 * never changes what a gesture does.
 */
export const FileRow = memo(function FileRow({
  entry,
  selected,
  showPath,
  canMove,
  dragging,
  onSelect,
  onOpen,
  onDragStart,
  onDragEnd,
  onDropInto,
}: Props) {
  const drop = useDropTarget(canMove && entry.isDirectory && !dragging, (paths) =>
    onDropInto(entry, paths),
  );

  const parentFolder = entry.path.includes('/')
    ? entry.path.slice(0, entry.path.lastIndexOf('/'))
    : '';

  return (
    <button
      type="button"
      aria-pressed={selected}
      title={`${entry.name}\n${entry.kind} · ${formatDate(entry.addedAt)}`}
      onClick={(event) =>
        onSelect(entry, { toggle: event.metaKey || event.ctrlKey, range: event.shiftKey })
      }
      onDoubleClick={() => onOpen(entry)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onOpen(entry);
        }
      }}
      draggable={canMove}
      onDragStart={(event) => setDragPayload(event.dataTransfer, onDragStart(entry))}
      onDragEnd={onDragEnd}
      {...drop.handlers}
      className={[
        'flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        dragging ? 'opacity-40' : '',
        drop.active
          ? 'bg-[var(--accent)] text-white'
          : selected
            ? 'bg-[var(--accent-soft)]'
            : 'hover:bg-[var(--surface-hover)]',
      ].join(' ')}
    >
      <RowIcon entry={entry} />

      <div className="min-w-0 flex-1">
        <div
          className={[
            'truncate text-[13px] leading-tight',
            drop.active
              ? 'font-semibold text-white'
              : selected
                ? 'font-semibold text-[var(--accent)]'
                : 'text-[var(--text)]',
          ].join(' ')}
        >
          {entry.name}
        </div>
        {/* The phone has no room for the trailing columns, so the essentials
            move under the name instead. */}
        <div
          className={[
            'mt-0.5 truncate text-[11px] sm:hidden',
            drop.active ? 'text-white/80' : 'text-[var(--text-muted)]',
          ].join(' ')}
        >
          {entrySubtitle(entry.isDirectory, entry.size, entry.childCount)} · {formatDate(entry.modifiedAt)}
        </div>
        {showPath && parentFolder && (
          <div
            className={[
              'mt-0.5 truncate text-[10.5px]',
              drop.active ? 'text-white/70' : 'text-[var(--text-faint)]',
            ].join(' ')}
          >
            in {parentFolder}
          </div>
        )}
      </div>

      {drop.active ? (
        <span className="shrink-0 text-[11.5px] font-semibold text-white">Move here</span>
      ) : (
        <>
          <span className="hidden w-32 shrink-0 truncate text-right text-[11.5px] text-[var(--text-muted)] lg:block">
            {entry.kind}
          </span>
          <span className="hidden w-20 shrink-0 text-right text-[11.5px] tabular-nums text-[var(--text-muted)] sm:block">
            {entry.isDirectory
              ? entrySubtitle(true, entry.size, entry.childCount)
              : formatBytes(entry.size)}
          </span>
          <span className="hidden w-28 shrink-0 text-right text-[11.5px] tabular-nums text-[var(--text-muted)] sm:block">
            {formatDate(entry.modifiedAt)}
          </span>
        </>
      )}

      {selected && !drop.active && (
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white">
          <CheckIcon size={10} />
        </span>
      )}
    </button>
  );
});
