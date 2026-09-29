import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '../../lib/utils.js';

// Single-value searchable dropdown. `options` = [{ value, label, description?, disabled? }]
// A disabled option is shown (with its description saying why) but can't be picked.
export function SearchableSelect({ options = [], value, onChange, placeholder = 'Select...', error, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-lg border bg-slate-50 px-3.5 text-left text-sm outline-none transition-colors dark:bg-navy-light',
          error ? 'border-red-400' : 'border-slate-200 dark:border-slate-700',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        <span className={selected ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && !disabled && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-navy-light">
          <div className="p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-navy"
            />
          </div>
          <div className="max-h-56 overflow-y-auto pb-1">
            {filtered.length === 0 && <p className="px-3 py-3 text-sm text-slate-400">No matches found</p>}
            {filtered.map((opt) => (
              <button
                type="button"
                key={opt.value}
                disabled={opt.disabled}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-navy',
                  opt.value === value && 'bg-brand-50 dark:bg-brand-500/10',
                  opt.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent dark:hover:bg-transparent'
                )}
              >
                <span className="font-medium text-slate-800 dark:text-slate-100">{opt.label}</span>
                {opt.description && <span className="text-xs text-slate-400">{opt.description}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Multi-value searchable picker with chips. `options` = [{ value, label }]
export function MultiSearchSelect({ options = [], value = [], onChange, placeholder = 'Search and select...' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selectedOptions = options.filter((o) => value.includes(o.value));
  const filtered = options.filter(
    (o) => !value.includes(o.value) && o.label.toLowerCase().includes(query.toLowerCase())
  );

  const toggle = (val) => {
    onChange(value.includes(val) ? value.filter((v) => v !== val) : [...value, val]);
  };

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-navy-light"
      >
        {selectedOptions.map((opt) => (
          <span
            key={opt.value}
            className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
          >
            {opt.label}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(opt.value);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={selectedOptions.length === 0 ? placeholder : ''}
          className="min-w-[120px] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-slate-400"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1.5 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-navy-light">
          {filtered.length === 0 && <p className="px-3 py-3 text-sm text-slate-400">No more matches</p>}
          {filtered.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => {
                toggle(opt.value);
                setQuery('');
              }}
              className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-navy"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
