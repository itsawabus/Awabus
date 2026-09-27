import { cn } from '../../lib/utils.js';

export default function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-navy-light',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export const CardHeader = ({ title, subtitle, action, className }) => (
  <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800', className)}>
    <div>
      <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const CardBody = ({ className, children }) => <div className={cn('p-5', className)}>{children}</div>;
