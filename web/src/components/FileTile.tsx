import { memo, useState } from 'react';
import { useDropTarget } from '../hooks/useDropTarget';
import { thumbnailUrl } from '../lib/api';
import { setDragPayload } from '../lib/dnd';
import { badgeText, entrySubtitle, formatDate } from '../lib/format';
import type { Entry } from '../lib/types';
import { CategoryIcon, CheckIcon, ContainerIcon, isContainer } from './Icons';

interface Props {
  entry: Entry;
  selected: boolean;
  showPath: boolean;
  /** Whether entries can be picked up and dropped into folders at all. */
  canMove: boolean;
  /** This tile is part of the drag currently in flight. */
  dragging: boolean;
  onSelect: (entry: Entry, modifiers: { toggle: boolean; range: boolean }) => void;
  onOpen: (entry: Entry) => void;
  /** Returns the paths this drag should carry — the whole selection, or just this tile. */
  onDragStart: (entry: Entry) => string[];
  onDragEnd: () => void;
  onDropInto: (folder: Entry, paths: string[]) => void;
}

function Thumbnail({ entry }: { entry: Entry }) {
  const [failed, setFailed] = useState(false);

  if (entry.hasThumbnail && !failed) {
    return (
      <img
        src={thumbnailUrl(entry.path)}
        alt=""
        loading="lazy"
        decoding="async"
        // The server has no thumbnail for some formats (SVG, camera raw, a
        // codec ffmpeg cannot open) and answers 404 — fall back to the badge.
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
    );
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-1.5 text-[var(--text-muted)]">
      <CategoryIcon category={entry.category} size={26} />
      <span className="text-[9.5px] font-semibold tracking-wide text-[var(--text-faint)]">
        {badgeText(entry.name, entry.category)}
      </span>
    </div>
  );
}

export const FileTile = memo(function FileTile({
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
  const parentFolder = entry.path.includes('/')
    ? entry.path.slice(0, entry.path.lastIndexOf('/'))
    : '';

  // A folder accepts a drop unless it is itself being dragged, which would
  // mean dropping it into itself.
  const drop = useDropTarget(canMove && entry.isDirectory && !dragging, (paths) =>
    onDropInto(entry, paths),
  );
  const container = isContainer(entry);

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
        'group flex flex-col gap-2 rounded-xl p-1.5 text-left outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        dragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      <div
        className={[
          'relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl transition-colors',
          // A container's glyph is the identifier, so it gets no frame — only
          // a tint when it is selected or being dropped onto.
          container
            ? drop.active
              ? 'bg-[var(--accent)]'
              : selected
                ? 'bg-[var(--accent-soft)] ring-[2.5px] ring-[var(--accent)]'
                : 'group-hover:bg-[var(--surface-hover)]'
            : [
                'bg-[var(--placeholder)]',
                drop.active
                  ? 'ring-[2.5px] ring-[var(--accent)]'
                  : selected
                    ? 'ring-[2.5px] ring-[var(--accent)]'
                    : 'ring-1 ring-[var(--border-subtle)] group-hover:ring-[var(--border)]',
              ].join(' '),
        ].join(' ')}
      >
        {container ? (
          // Sized as a share of the tile so it stays as dominant as a
          // full-bleed thumbnail at every grid track width.
          <ContainerIcon entry={entry} className="h-auto w-[78%]" />
        ) : (
          <Thumbnail entry={entry} />
        )}

        {/* While a drag hovers, the folder says what dropping will do. */}
        {drop.active && (
          <span
            className={[
              'pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white',
              container ? '' : 'bg-[color-mix(in_srgb,var(--accent)_78%,transparent)]',
            ].join(' ')}
          >
            Move here
          </span>
        )}

        {selected && !drop.active && (
          <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow">
            <CheckIcon size={12} />
          </span>
        )}
      </div>

      <div className="min-w-0 px-0.5">
        <div
          className={[
            'truncate text-[12.5px] leading-tight',
            selected ? 'font-semibold text-[var(--accent)]' : 'text-[var(--text)]',
          ].join(' ')}
        >
          {entry.name}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
          {entrySubtitle(entry.isDirectory, entry.size, entry.childCount)}
        </div>
        {/* In search results the folder matters as much as the name. */}
        {showPath && parentFolder && (
          <div className="mt-0.5 truncate text-[10.5px] text-[var(--text-faint)]">
            in {parentFolder}
          </div>
        )}
      </div>
    </button>
  );
});
