/**
 * Dragging entries between folders inside the gallery.
 *
 * The payload rides on a custom MIME type so it is trivially distinguishable
 * from a drag of real files off the desktop: the window-level upload handler
 * looks for `Files`, drop targets in the grid look for this. A drag can never
 * be read as both.
 */
export const ENTRY_DRAG_TYPE = 'application/x-fileshare-entries';

export function setDragPayload(transfer: DataTransfer, paths: string[]): void {
  transfer.setData(ENTRY_DRAG_TYPE, JSON.stringify(paths));
  transfer.effectAllowed = 'move';
}

/** True during dragover, where the payload itself is not yet readable. */
export function isEntryDrag(transfer: DataTransfer | null): boolean {
  return transfer?.types.includes(ENTRY_DRAG_TYPE) ?? false;
}

/** The dragged paths, readable only in a `drop` handler. */
export function readDragPayload(transfer: DataTransfer | null): string[] {
  const raw = transfer?.getData(ENTRY_DRAG_TYPE);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
