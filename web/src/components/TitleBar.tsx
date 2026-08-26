import { useEffect, useRef } from 'react';
import type { Connection } from '../hooks/useConnection';
import type { SortDirection, SortKey } from '../lib/types';
import { ArrowUpIcon, CloseIcon, NewFolderIcon, SearchIcon, UploadIcon } from './Icons';

interface Props {
  hostname: string;
  connection: Connection;
  query: string;
  sort: SortKey;
  direction: SortDirection;
  canWrite: boolean;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: SortKey) => void;
  onDirectionToggle: () => void;
  onUploadClick: () => void;
  onNewFolderClick: () => void;
}

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'date', label: 'Date' },
  { key: 'name', label: 'Name' },
  { key: 'size', label: 'Size' },
];

function ConnectionDot({ status }: { status: Connection }) {
  const label =
    status === 'online' ? 'Tailscale' : status === 'checking' ? 'Connecting' : 'Offline';
  const color =
    status === 'online'
      ? 'text-[var(--success)]'
      : status === 'checking'
        ? 'text-[var(--text-faint)]'
        : 'text-[var(--warning)]';

  return (
    <span className={`flex shrink-0 items-center gap-1.5 text-[11px] font-medium ${color}`}>
      <span aria-hidden="true">●</span>
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function TitleBar({
  hostname,
  connection,
  query,
  sort,
  direction,
  canWrite,
  onQueryChange,
  onSortChange,
  onDirectionToggle,
  onUploadClick,
  onNewFolderClick,
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const inField = event.target instanceof HTMLInputElement;
      if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === '/' && !inField) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface-raised)]">
      {/* Row one is the window title bar from the mockup. It carries the safe
          area inset so the standalone iOS app clears the status bar. */}
      <div
        className="flex items-center gap-3 px-4 pb-2"
        style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
      >
        <h1 className="min-w-0 flex-1 truncate text-[13px] font-semibold sm:text-center">
          Files{hostname ? ` — ${hostname}` : ''}
        </h1>
        <ConnectionDot status={connection} />
      </div>

      <div className="flex items-center gap-2 px-3 pb-2.5 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
          <SearchIcon size={15} className="shrink-0 text-[var(--text-muted)]" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search filenames"
            aria-label="Search filenames"
            // 16px keeps iOS Safari from zooming the viewport on focus.
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[var(--text-muted)] sm:text-[13px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Clear search"
              className="shrink-0 rounded text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <CloseIcon size={15} />
            </button>
          )}
        </div>

        <div className="hidden items-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[12px] sm:flex">
          {SORTS.map((option, index) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={sort === option.key}
              onClick={() => onSortChange(option.key)}
              className={[
                'px-2.5 py-1.5 transition-colors',
                index > 0 ? 'border-l' : '',
                // Selected fills with the accent, matching the filter chips
                // directly below it — weight alone read as no selection at all.
                // The border blends into the fill so the segment stays clean.
                sort === option.key
                  ? 'border-[var(--accent)] bg-[var(--accent)] font-semibold text-white'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onDirectionToggle}
            aria-label={direction === 'asc' ? 'Sort descending' : 'Sort ascending'}
            className="border-l border-[var(--border)] px-2 py-1.5 text-[var(--accent)] hover:bg-[var(--surface-hover)]"
          >
            <ArrowUpIcon
              size={14}
              className={direction === 'desc' ? 'rotate-180 transition-transform' : 'transition-transform'}
            />
          </button>
        </div>

        {/* The phone gets a native select — a segmented control plus a
            direction toggle is more chrome than the width allows. */}
        <label className="sm:hidden">
          <span className="sr-only">Sort by</span>
          <select
            value={`${sort}:${direction}`}
            onChange={(event) => {
              const [nextSort, nextDirection] = event.target.value.split(':') as [
                SortKey,
                SortDirection,
              ];
              onSortChange(nextSort);
              if (nextDirection !== direction) onDirectionToggle();
            }}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-[13px]"
          >
            <option value="date:desc">Newest</option>
            <option value="date:asc">Oldest</option>
            <option value="name:asc">Name A–Z</option>
            <option value="name:desc">Name Z–A</option>
            <option value="size:desc">Largest</option>
            <option value="size:asc">Smallest</option>
          </select>
        </label>

        {canWrite && (
          <>
            <button
              type="button"
              onClick={onNewFolderClick}
              aria-label="New folder"
              className="hidden size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] sm:flex"
            >
              <NewFolderIcon size={17} />
            </button>
            <button
              type="button"
              onClick={onUploadClick}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-[12.5px] font-semibold text-white active:opacity-80"
            >
              <UploadIcon size={15} />
              <span className="hidden sm:inline">Upload</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
