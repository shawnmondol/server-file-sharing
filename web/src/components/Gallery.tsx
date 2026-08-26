import type { Entry } from '../lib/types';
import { FileTile } from './FileTile';

interface Props {
  entries: Entry[];
  selected: Set<string>;
  showPaths: boolean;
  onSelect: (entry: Entry, modifiers: { toggle: boolean; range: boolean }) => void;
  onOpen: (entry: Entry) => void;
}

export function Gallery({ entries, selected, showPaths, onSelect, onOpen }: Props) {
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
          onSelect={onSelect}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
