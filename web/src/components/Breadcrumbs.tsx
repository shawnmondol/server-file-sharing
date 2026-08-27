import { useState, type DragEvent } from 'react';
import { isEntryDrag, readDragPayload } from '../lib/dnd';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';
import type { Crumb } from '../lib/types';

interface Props {
  crumbs: Crumb[];
  canMove: boolean;
  onNavigate: (path: string) => void;
  onDropInto: (destination: string, paths: string[]) => void;
}

/**
 * Drop handlers for one crumb. Dragging onto an ancestor is the only way to
 * move something *out* of the folder you are looking at — tiles can only take
 * things further down the tree.
 */
function useCrumbDrop(
  enabled: boolean,
  destination: string,
  onDropInto: (destination: string, paths: string[]) => void,
) {
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
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      },
      onDragLeave: () => setDepth((current) => Math.max(0, current - 1)),
      onDrop: (event: DragEvent) => {
        if (!isEntryDrag(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        setDepth(0);
        const paths = readDragPayload(event.dataTransfer);
        if (paths.length > 0) onDropInto(destination, paths);
      },
    },
  };
}

function CrumbLink({
  crumb,
  canMove,
  onNavigate,
  onDropInto,
}: {
  crumb: Crumb;
  canMove: boolean;
  onNavigate: (path: string) => void;
  onDropInto: (destination: string, paths: string[]) => void;
}) {
  const drop = useCrumbDrop(canMove, crumb.path, onDropInto);

  return (
    <button
      type="button"
      onClick={() => onNavigate(crumb.path)}
      {...drop.handlers}
      className={[
        'max-w-[10rem] truncate rounded px-1 hover:text-[var(--text)] hover:underline',
        drop.active ? 'bg-[var(--accent)] text-white no-underline hover:text-white' : '',
      ].join(' ')}
      title={crumb.name}
    >
      {crumb.name}
    </button>
  );
}

export function Breadcrumbs({ crumbs, canMove, onNavigate, onDropInto }: Props) {
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2] : null;
  const backDrop = useCrumbDrop(canMove && parent !== null, parent?.path ?? '', onDropInto);

  return (
    <nav
      aria-label="Folder path"
      className="flex min-w-0 items-center gap-1 text-[13px] text-[var(--text-muted)]"
    >
      {/* On a phone the full trail rarely fits, so a back affordance leads. */}
      {parent && (
        <button
          type="button"
          onClick={() => onNavigate(parent.path)}
          {...backDrop.handlers}
          className={[
            'mr-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg sm:hidden',
            backDrop.active
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--accent)] hover:bg-[var(--surface-hover)]',
          ].join(' ')}
          aria-label={`Back to ${parent.name}`}
        >
          <ChevronLeftIcon size={18} />
        </button>
      )}

      <ol className="flex min-w-0 items-center gap-1">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          // Keep the root and the last two levels; elide the middle.
          const collapsed = crumbs.length > 4 && index > 0 && index < crumbs.length - 2;
          if (collapsed) {
            return index === 1 ? (
              <li key="ellipsis" className="hidden shrink-0 items-center gap-1 sm:flex">
                <ChevronRightIcon size={14} className="text-[var(--text-faint)]" />
                <span aria-hidden="true">…</span>
              </li>
            ) : null;
          }

          return (
            <li key={crumb.path} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRightIcon size={14} className="shrink-0 text-[var(--text-faint)]" />
              )}
              {isLast ? (
                // The last crumb is the folder you are already in; there is
                // nowhere for a drop to move anything to.
                <span
                  aria-current="page"
                  className="truncate font-semibold text-[var(--text)]"
                  title={crumb.name}
                >
                  {crumb.name}
                </span>
              ) : (
                <CrumbLink
                  crumb={crumb}
                  canMove={canMove}
                  onNavigate={onNavigate}
                  onDropInto={onDropInto}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
