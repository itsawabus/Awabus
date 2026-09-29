import { cn } from '../../lib/utils.js';

export const Table = ({ children, className }) => (
  <div className="overflow-x-auto">
    <table className={cn('w-full min-w-[720px] border-collapse text-left text-sm', className)}>{children}</table>
  </div>
);

export const Thead = ({ children }) => (
  <thead>
    <tr className="border-b border-slate-100 dark:border-slate-800">{children}</tr>
  </thead>
);

export const Th = ({ children, className }) => (
  <th
    className={cn(
      'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500',
      className
    )}
  >
    {children}
  </th>
);

export const Tbody = ({ children }) => <tbody>{children}</tbody>;

export const Tr = ({ children, className, ...props }) => (
  <tr className={cn('border-b border-slate-50 last:border-0 hover:bg-slate-50/70 dark:border-slate-800/60 dark:hover:bg-navy/40', className)} {...props}>
    {children}
  </tr>
);

export const Td = ({ children, className }) => (
  <td className={cn('whitespace-nowrap px-4 py-3.5 text-slate-700 dark:text-slate-300', className)}>{children}</td>
);
