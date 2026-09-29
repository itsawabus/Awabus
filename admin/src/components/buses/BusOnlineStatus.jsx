import { cn } from '../../lib/utils.js';

/**
 * What the two readings together say:
 *   driver online  = the driver app reaches the school (mobile data on)
 *   bus online     = the phone is reading the bus location (location on)
 */
export function connectionReason({ busOnline, driverOnline, hasDriver = true }) {
  if (!hasDriver) return 'No driver assigned to this bus';
  if (busOnline && driverOnline) return 'Data and location are on';
  if (busOnline) return 'Location is on; the driver app is not reaching the school right now';
  if (driverOnline) return "Driver's location is off: the school cannot see the bus";
  return "Driver's mobile data is off, the app is closed or the driver signed out";
}

/**
 * Bus online: the driver's phone is reading the bus location now. Offline:
 * location is off, the phone has no data, the app is closed or the driver
 * signed out.
 */
export default function BusOnlineStatus({ busOnline, driverOnline, hasDriver = true, showReason = false, label = 'Bus', className }) {
  const online = Boolean(busOnline);
  const reason = connectionReason({ busOnline: online, driverOnline, hasDriver });
  return (
    <span className={cn('inline-flex flex-col', className)} title={reason}>
      <span
        className={cn(
          'inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
          online
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-300'
        )}
      >
        <span className={cn('h-2 w-2 rounded-full', online ? 'bg-emerald-500' : 'bg-slate-400')} />
        {label ? `${label} ${online ? 'online' : 'offline'}` : online ? 'Online' : 'Offline'}
      </span>
      {showReason && !(online && driverOnline) && <span className="mt-1 max-w-[16rem] text-xs text-slate-400">{reason}</span>}
    </span>
  );
}

/** Driver (data) and bus (location) side by side. */
export function ConnectionPair({ busOnline, driverOnline, hasDriver = true, showReason = true, className }) {
  const reason = connectionReason({ busOnline, driverOnline, hasDriver });
  return (
    <span className={cn('inline-flex flex-col gap-1', className)}>
      <span className="inline-flex flex-wrap gap-1.5">
        <Pill online={driverOnline} text={`Driver ${driverOnline ? 'online' : 'offline'}`} title="Mobile data: the driver app is reaching the school" />
        <Pill online={busOnline} text={`Bus ${busOnline ? 'online' : 'offline'}`} title="Location: the driver's phone is reading the bus position" />
      </span>
      {showReason && !(busOnline && driverOnline) && <span className="text-xs text-slate-500 dark:text-slate-400">{reason}</span>}
    </span>
  );
}

function Pill({ online, text, title }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
        online
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-300'
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', online ? 'bg-emerald-500' : 'bg-slate-400')} />
      {text}
    </span>
  );
}
