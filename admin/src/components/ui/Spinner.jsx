import { cn } from '../../lib/utils.js';

export default function Spinner({ className, size = 'md' }) {
  const sizes = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-10 w-10 border-[3px]' };
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-brand-500 border-t-transparent',
        sizes[size],
        className
      )}
    />
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
      <Spinner size="lg" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
