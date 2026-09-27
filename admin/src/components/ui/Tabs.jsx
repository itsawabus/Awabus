import { cn } from '../../lib/utils.js';

export default function Tabs({ tabs, active, onChange, className }) {
  return (
    <div className={cn('flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800', className)}>
      {tabs.map((tab) => {
        const value = typeof tab === 'string' ? tab : tab.value;
        const label = typeof tab === 'string' ? tab : tab.label;
        const isActive = active === value;
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              isActive
                ? 'border-brand-600 text-brand-700 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function PillTabs({ tabs, active, onChange, className }) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {tabs.map((tab) => {
        const value = typeof tab === 'string' ? tab : tab.value;
        const label = typeof tab === 'string' ? tab : tab.label;
        const isActive = active === value;
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={cn(
              'rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors',
              isActive
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-navy-light dark:text-slate-300 dark:hover:bg-navy'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
