import type { ViewMode } from '../lib/types';
import { GridViewIcon, ListViewIcon } from './Icons';

interface Props {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

const OPTIONS: Array<{ key: ViewMode; label: string; Icon: typeof GridViewIcon }> = [
  { key: 'grid', label: 'Grid view', Icon: GridViewIcon },
  { key: 'list', label: 'List view', Icon: ListViewIcon },
];

/**
 * Lives in the breadcrumb row rather than the toolbar: it controls the listing
 * directly beneath it, and the toolbar has no room for it on a phone.
 */
export function ViewToggle({ view, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="View"
      className="flex shrink-0 items-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]"
    >
      {OPTIONS.map((option, index) => {
        const active = view === option.key;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(option.key)}
            className={[
              'flex size-7 items-center justify-center transition-colors',
              index > 0 ? 'border-l border-[var(--border)]' : '',
              active
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]',
            ].join(' ')}
          >
            <option.Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}
