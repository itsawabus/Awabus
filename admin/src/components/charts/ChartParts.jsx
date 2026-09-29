import { useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import Card from '../ui/Card.jsx';
import { cn } from '../../lib/utils.js';

/** A card holding one chart, with a Chart / Table switch so no value is hover-only. */
export function ChartCard({ title, subtitle, legend, table, dim, className, children, action }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={cn('viz flex flex-col', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {table && (
            <button
              type="button"
              onClick={() => setAsTable((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-navy"
              aria-pressed={asTable}
            >
              {asTable ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
              {asTable ? 'Chart' : 'Table'}
            </button>
          )}
        </div>
      </div>
      {legend && !asTable && <div className="px-5 pt-3">{legend}</div>}
      <div className={cn('flex-1 px-5 pb-5 pt-3 transition-opacity', dim && 'opacity-60')}>
        {asTable && table ? <DataTable {...table} /> : children}
      </div>
    </Card>
  );
}

export function DataTable({ columns, rows }) {
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 dark:bg-navy">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cn('px-3 py-2 text-xs font-semibold text-slate-500', c.align === 'right' ? 'text-right' : 'text-left')}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r, i) => (
            <tr key={r.id || i}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn('px-3 py-1.5 text-slate-700 dark:text-slate-200', c.align === 'right' && 'text-right tabular-nums')}
                >
                  {c.format ? c.format(r[c.key], r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Legend: a swatch that mirrors the mark (square for bars), text in ink colours. */
export function Legend({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: it.color }} />
          {it.icon && <it.icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Tooltip positioned inside the chart's relative wrapper; flips to stay on screen. */
export function Tooltip({ x, y, width, children }) {
  if (x === null || x === undefined) return null;
  const flip = width && x > width - 190;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-[9rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-navy"
      style={{ left: flip ? undefined : x + 12, right: flip ? width - x + 12 : undefined, top: Math.max(0, y - 10) }}
    >
      {children}
    </div>
  );
}

/** One tooltip row: value first (strong), then the series name, keyed by a short line. */
export function TipRow({ color, value, label }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {color && <span className="h-0.5 w-3 shrink-0 rounded" style={{ background: color }} />}
      <span className="font-bold tabular-nums text-slate-900 dark:text-white">{value}</span>
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}
