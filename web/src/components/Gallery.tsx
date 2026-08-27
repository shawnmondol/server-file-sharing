import type { Entry, ViewMode } from '../lib/types';
import { FileRow } from './FileRow';
import { FileTile } from './FileTile';

interface Props {
  entries: Entry[];
  selected: Set<string>;
  showPaths: boolean;
  view: ViewMode;
  canMove: boolean;
  draggingPaths: Set<string>;
  onSelect: (entry: Entry, modifiers: { toggle: boolean; range: boolean }) => void;
  onOpen: (entry: Entry) => void;
  onDragStart: (entry: Entry) => string[];
  onDragEnd: () => void;
  onDropInto: (folder: Entry, paths: string[]) => void;
}

export function Gallery({
  entries,
  selected,
  showPaths,
  view,
  canMove,
  draggingPaths,
  onSelect,
  onOpen,
  onDragStart,
  onDragEnd,
  onDropInto,
}: Props) {
  const shared = (entry: Entry) => ({
    key: entry.path,
    entry,
    selected: selected.has(entry.path),
    showPath: showPaths,
    canMove,
    dragging: draggingPaths.has(entry.path),
    onSelect,
    onOpen,
    onDragStart,
    onDragEnd,
    onDropInto,
  });

  if (view === 'list') {
    return (
      <div role="grid" aria-label="Files" className="flex flex-col gap-px p-2 sm:p-3">
        {/* Column headings only where the columns actually show. */}
        <div className="hidden items-center gap-3 px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-faint)] sm:flex">
          <span className="size-9 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">Name</span>
          <span className="hidden w-32 shrink-0 text-right lg:block">Kind</span>
          <span className="w-20 shrink-0 text-right">Size</span>
          <span className="w-28 shrink-0 text-right">Modified</span>
        </div>

        {entries.map((entry) => (
          <FileRow {...shared(entry)} />
        ))}
      </div>
    );
  }

  return (
    <div
      role="grid"
      aria-label="Files"
      // auto-fill with a min track keeps the tile size roughly constant from
      // a phone through to a wide desktop, rather than stretching three
      // columns across 1600px.
      className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2 p-3 sm:grid-cols-[repeat(auto-fill,minmax(136px,1fr))] sm:gap-3 sm:p-4"
    >
      {entries.map((entry) => (
        <FileTile {...shared(entry)} />
      ))}
    </div>
  );
}
