import type { Entry } from '../lib/types';
import { FileTile } from './FileTile';

interface Props {
  entries: Entry[];
  selected: Set<string>;
  showPaths: boolean;
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
  canMove,
  draggingPaths,
  onSelect,
  onOpen,
  onDragStart,
  onDragEnd,
  onDropInto,
}: Props) {
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
        <FileTile
          key={entry.path}
          entry={entry}
          selected={selected.has(entry.path)}
          showPath={showPaths}
          canMove={canMove}
          dragging={draggingPaths.has(entry.path)}
          onSelect={onSelect}
          onOpen={onOpen}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDropInto={onDropInto}
        />
      ))}
    </div>
  );
}
