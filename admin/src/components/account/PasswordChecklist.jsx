import { Check, X } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { passwordChecks } from '../../lib/password.js';

/** Live list of the password rules, ticked off as the user types. */
export default function PasswordChecklist({ password, email, name }) {
  const checks = passwordChecks(password, { email, name });
  const passed = checks.filter((c) => c.ok).length;
  const strength = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-amber-500', 'bg-brand-500', 'bg-green-600'][passed];
  return (
    <div className="mt-2">
      <div className="mb-2 flex gap-1">
        {checks.map((c, i) => (
          <span key={c.label} className={cn('h-1.5 flex-1 rounded-full', i < passed ? strength : 'bg-slate-200 dark:bg-slate-700')} />
        ))}
      </div>
      <ul className="space-y-1">
        {checks.map((c) => (
          <li
            key={c.label}
            className={cn('flex items-center gap-1.5 text-xs', c.ok ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400')}
          >
            {c.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
