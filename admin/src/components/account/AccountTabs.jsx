import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils.js';

const TABS = [
  { to: '/account/profile', label: 'My profile' },
  { to: '/account/settings', label: 'Account settings' },
];

/** Tab strip shared by the My profile and Account settings pages. */
export default function AccountTabs() {
  return (
    <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-800">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              isActive
                ? 'border-brand-600 text-brand-700 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}

/** Green confirmation banner that clears itself after a few seconds. */
export function SuccessNote({ message, onDone }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onDone, 5000);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div
      role="status"
      className="mb-5 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400"
    >
      <CheckCircle2 className="h-4 w-4" />
      {message}
    </div>
  );
}
