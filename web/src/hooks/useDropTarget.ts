import { useState, type DragEvent } from 'react';
import { isEntryDrag, readDragPayload } from '../lib/dnd';

/**
 * Drop-target plumbing shared by every place you can drop entries: folder
 * tiles, folder rows in the list view, and breadcrumbs.
 *
 * dragenter/dragleave fire once per child element, so "is the pointer over
 * me" has to be a depth counter rather than a boolean.
 */
export function useDropTarget(enabled: boolean, onDrop: (paths: string[]) => void) {
  const [depth, setDepth] = useState(0);

  if (!enabled) return { active: false, handlers: {} };

  return {
    active: depth > 0,
    handlers: {
      onDragEnter: (event: DragEvent) => {
        if (!isEntryDrag(event.dataTransfer)) return;
        setDepth((current) => current + 1);
      },
      onDragOver: (event: DragEvent) => {
        if (!isEntryDrag(event.dataTransfer)) return;
        // Without preventDefault the browser refuses the drop outright.
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      },
      onDragLeave: () => setDepth((current) => Math.max(0, current - 1)),
      onDrop: (event: DragEvent) => {
        if (!isEntryDrag(event.dataTransfer)) return;
        event.preventDefault();
        // Stop the window-level upload handler from seeing this as a file drop.
        event.stopPropagation();
        setDepth(0);
        const paths = readDragPayload(event.dataTransfer);
        if (paths.length > 0) onDrop(paths);
      },
    },
  };
}
