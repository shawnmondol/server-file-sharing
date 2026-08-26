import { ChevronLeftIcon, ChevronRightIcon } from './Icons';
import type { Crumb } from '../lib/types';

interface Props {
  crumbs: Crumb[];
  onNavigate: (path: string) => void;
}

export function Breadcrumbs({ crumbs, onNavigate }: Props) {
  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2] : null;

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
          className="mr-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-[var(--accent)] hover:bg-[var(--surface-hover)] sm:hidden"
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
                <span
                  aria-current="page"
                  className="truncate font-semibold text-[var(--text)]"
                  title={crumb.name}
                >
                  {crumb.name}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate(crumb.path)}
                  className="max-w-[10rem] truncate rounded px-1 hover:text-[var(--text)] hover:underline"
                  title={crumb.name}
                >
                  {crumb.name}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
