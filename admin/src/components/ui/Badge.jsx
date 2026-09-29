import { cn } from '../../lib/utils.js';
import { statusToneMap } from '../../lib/utils.js';

const TONE_CLASSES = {
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  danger: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
};

export default function Badge({ children, tone, className, title }) {
  const key = Array.isArray(children) ? children[children.length - 1] : children;
  const resolvedTone = tone || statusToneMap[key] || 'neutral';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        TONE_CLASSES[resolvedTone],
        className
      )}
      title={title}
    >
      {children}
    </span>
  );
}
