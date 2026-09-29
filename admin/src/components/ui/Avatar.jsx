import { initials, cn } from '../../lib/utils.js';

export default function Avatar({ name, src, size = 'md', className }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-lg' };
  if (src) {
    return <img src={src} alt={name} className={cn('rounded-full object-cover', sizes[size], className)} />;
  }
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300',
        sizes[size],
        className
      )}
    >
      {initials(name) || '?'}
    </span>
  );
}
