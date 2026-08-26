import { CATEGORY_LABELS } from '../lib/format';
import type { Category } from '../lib/types';

interface Props {
  categories: Array<{ category: Category; count: number }>;
  active: string;
  totalCount: number;
  onChange: (category: string) => void;
}

export function FilterChips({ categories, active, totalCount, onChange }: Props) {
  const chips = [
    { key: 'all', label: 'All', count: totalCount },
    ...categories.map((entry) => ({
      key: entry.category,
      label: CATEGORY_LABELS[entry.category],
      count: entry.count,
    })),
  ];

  return (
    <div
      role="group"
      aria-label="Filter by file type"
      // Horizontal scroll rather than wrapping: with 17 possible types a
      // wrapped row would eat half the phone screen.
      className="scroll-pane flex gap-2 overflow-x-auto px-3 py-2 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((chip) => {
        const selected = chip.key === active;
        return (
          <button
            key={chip.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(chip.key)}
            className={[
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
              selected
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--surface)] text-[var(--text-muted)] ring-1 ring-[var(--border)] hover:text-[var(--text)]',
            ].join(' ')}
          >
            {chip.label}
            <span className={selected ? 'text-white/75' : 'text-[var(--text-faint)]'}>
              {chip.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
