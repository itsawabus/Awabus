import { AlertTriangle, Bus, FileSpreadsheet, Route as RouteIcon, Trash2 } from 'lucide-react';
import { cn, formatDateTime, timeAgo } from '../../lib/utils.js';
import Checkbox from '../ui/Checkbox.jsx';

const LOOK = {
  critical: { icon: AlertTriangle, tone: 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400' },
  trips: { icon: RouteIcon, tone: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400' },
  fleet: { icon: Bus, tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' },
  account: { icon: FileSpreadsheet, tone: 'bg-slate-100 text-slate-500 dark:bg-navy dark:text-slate-400' },
};

// "5m ago" for today's notifications, a date and time for older ones.
export const whenLabel = (value) =>
  Date.now() - new Date(value).getTime() < 24 * 60 * 60 * 1000 ? timeAgo(value) : formatDateTime(value);

/**
 * One notification row, used in the top-bar panel and on the Notifications page.
 * - onDelete: shows a delete button on the row.
 * - selecting / selected / onToggle: selection mode (a tick box; clicking the
 *   row ticks it instead of opening it).
 */
export default function NotificationItem({ item, onOpen, onDelete, selecting = false, selected = false, onToggle, compact = false }) {
  const { icon: Icon, tone } = LOOK[item.category] || LOOK.account;
  return (
    <div
      className={cn(
        'group flex items-start transition-colors hover:bg-slate-50 dark:hover:bg-navy',
        !item.read && 'bg-brand-50/40 dark:bg-brand-500/5',
        selected && 'bg-brand-50 dark:bg-brand-500/10'
      )}
    >
      {selecting && (
        <span className={cn('flex shrink-0 items-center', compact ? 'pl-4 pt-4' : 'pl-5 pt-5')}>
          <Checkbox checked={selected} onChange={() => onToggle?.(item)} />
        </span>
      )}
      <button
        type="button"
        onClick={() => (selecting ? onToggle?.(item) : onOpen(item))}
        className={cn('flex min-w-0 flex-1 items-start gap-3 text-left', compact ? 'px-4 py-3' : 'px-5 py-4')}
      >
        <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className={cn('text-sm text-slate-900 dark:text-white', item.read ? 'font-medium' : 'font-bold')}>
              {item.title}
            </span>
            {!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
          </span>
          {item.message && (
            <span className={cn('mt-0.5 block text-sm text-slate-500 dark:text-slate-400', compact && 'line-clamp-2')}>
              {item.message}
            </span>
          )}
          <span className="mt-1 block text-xs text-slate-400">{whenLabel(item.createdAt)}</span>
        </span>
      </button>
      {onDelete && !selecting && (
        <button
          type="button"
          onClick={() => onDelete(item)}
          aria-label="Delete notification"
          title="Delete"
          className={cn(
            'shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 focus:opacity-100 dark:hover:bg-red-950/40 sm:opacity-0 sm:group-hover:opacity-100',
            compact ? 'mr-2 mt-2' : 'mr-3 mt-3'
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
