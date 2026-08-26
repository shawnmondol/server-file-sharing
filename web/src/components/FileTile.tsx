import { memo, useState } from 'react';
import { thumbnailUrl } from '../lib/api';
import { badgeText, entrySubtitle, formatDate } from '../lib/format';
import type { Entry } from '../lib/types';
import { CategoryIcon, CheckIcon } from './Icons';

interface Props {
  entry: Entry;
  selected: boolean;
  showPath: boolean;
  onSelect: (entry: Entry, modifiers: { toggle: boolean; range: boolean }) => void;
  onOpen: (entry: Entry) => void;
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
      <CategoryIcon category={entry.category} size={entry.isDirectory ? 30 : 26} />
      {!entry.isDirectory && (
        <span className="text-[9.5px] font-semibold tracking-wide text-[var(--text-faint)]">
          {badgeText(entry.name, entry.category)}
        </span>
      )}
    </div>
  );
}

export const FileTile = memo(function FileTile({
  entry,
  selected,
  showPath,
  onSelect,
  onOpen,
}: Props) {
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
      className="group flex flex-col gap-2 rounded-xl p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <div
        className={[
          'relative aspect-square w-full overflow-hidden rounded-xl bg-[var(--placeholder)] transition-shadow',
          selected
            ? 'ring-[2.5px] ring-[var(--accent)]'
            : 'ring-1 ring-[var(--border-subtle)] group-hover:ring-[var(--border)]',
        ].join(' ')}
      >
        <Thumbnail entry={entry} />

        {selected && (
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
