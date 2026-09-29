import { cn } from '../../lib/utils.js';
import { RIDE_SESSIONS } from '../../lib/sessions.js';

/**
 * Which runs a student rides: morning & evening, morning only or evening only.
 * A student is left off the trips of a run they don't ride.
 */
export default function RideSessionPicker({ value, onChange, label = "Rides" }) {
  const current = value || 'both';
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {RIDE_SESSIONS.map((s) => {
        const on = current === s.value;
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(s.value)}
            className={cn(
              'rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors',
              on
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-navy dark:text-slate-300'
            )}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
