import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export function LogsPagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return <div className="flex items-center gap-0.5" aria-hidden />;
  const items: Array<number | 'gap'> = [];
  const push = (v: number | 'gap') => items.push(v);
  const addRange = (s: number, e: number) => {
    for (let i = s; i <= e; i++) push(i);
  };
  if (totalPages <= 7) {
    addRange(1, totalPages);
  } else {
    addRange(1, 2);
    if (page > 4) push('gap');
    const start = Math.max(3, page - 1);
    const end = Math.min(totalPages - 2, page + 1);
    addRange(start, end);
    if (page < totalPages - 3) push('gap');
    addRange(totalPages - 1, totalPages);
  }
  return (
    <div className="flex items-center gap-0.5">
      <button className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-3 w-3" />
      </button>
      {items.map((it, i) =>
        it === 'gap' ? (
          <span key={`g-${i}`} className="px-1 text-ink-disabled">
            …
          </span>
        ) : (
          <button
            key={it}
            className={cn('page-btn', it === page && 'active')}
            onClick={() => onChange(it)}
          >
            {it}
          </button>
        ),
      )}
      <button
        className="page-btn"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}