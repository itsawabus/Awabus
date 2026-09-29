import { cn, formatDateTime, timeAgo } from '../../lib/utils.js';

// When the driver app last reached the school, in words.
export const lastSeenText = (driver) => {
  if (!driver?.lastSeenAt) return 'Has not opened the driver app yet';
  const seen = new Date(driver.lastSeenAt);
  const hours = (Date.now() - seen.getTime()) / 3600000;
  return `Last seen ${hours < 24 ? timeAgo(seen) : formatDateTime(seen)}`;
};

/**
 * Online: the driver app is open and signed in (it checks in every 30
 * seconds). Offline: signed out, app closed, phone off or no data for 2 minutes.
 */
export default function OnlineStatus({ driver, showLastSeen = false, className }) {
  const online = Boolean(driver?.online);
  return (
    <span className={cn('inline-flex flex-col', className)} title={online ? 'Driver app open now' : lastSeenText(driver)}>
      <span
        className={cn(
          'inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
          online
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-300'
        )}
      >
        <span className={cn('h-2 w-2 rounded-full', online ? 'bg-emerald-500' : 'bg-slate-400')} />
        {online ? 'Online' : 'Offline'}
      </span>
      {showLastSeen && !online && <span className="mt-1 whitespace-nowrap text-xs text-slate-400">{lastSeenText(driver)}</span>}
    </span>
  );
}
