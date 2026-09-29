import { Check } from 'lucide-react';
import { cn } from '../../lib/utils.js';

// Clicking the box or its words toggles it; Space toggles it from the keyboard.
export default function Checkbox({ checked, onChange, label, className }) {
  const toggle = () => onChange?.(!checked);
  return (
    <span
      role="checkbox"
      aria-checked={Boolean(checked)}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggle();
        }
      }}
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 select-none rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
        className
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
          checked
            ? 'border-brand-600 bg-brand-600 text-white'
            : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-navy-light'
        )}
      >
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>
      {label && <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>}
    </span>
  );
}
