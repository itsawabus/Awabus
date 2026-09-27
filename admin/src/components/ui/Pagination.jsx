import Button from './Button.jsx';

export default function Pagination({ page, totalPages, onChange, label }) {
  if (totalPages <= 1) return null;
  // Up to 5 page numbers, centred on the current page.
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }).map((_, i) => first + i);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-1 py-4 dark:border-slate-800">
      {label && <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={
              p === page
                ? 'flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-sm font-semibold text-white dark:bg-brand-600'
                : 'flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy'
            }
          >
            {p}
          </button>
        ))}
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
