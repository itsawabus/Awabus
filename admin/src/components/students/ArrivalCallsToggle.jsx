import { PhoneCall, PhoneOff } from 'lucide-react';
import Checkbox from '../ui/Checkbox.jsx';

export const arrivalCallsLabel = (on) => (on === false ? 'Off' : 'On');

/**
 * Whether the parent gets a phone call when the bus is almost at the home
 * (pickup in the morning, drop-off in the evening). For brothers and sisters
 * at one home, leaving it on for one child is enough: a parent is called once
 * per trip whichever way.
 */
export default function ArrivalCallsToggle({ value, onChange, note }) {
  const on = value !== false;
  const Icon = on ? PhoneCall : PhoneOff;
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <Checkbox checked={on} onChange={onChange} label="Call the parent when the bus is almost at the home (pickup and drop-off)" />
      <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {on
          ? 'Arrival calls are on. The parent is called at most once per trip, even with brothers or sisters on the bus.'
          : 'Arrival calls are off for this student. No call is made when the bus nears the home.'}
      </p>
      {note && <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">{note}</p>}
    </div>
  );
}
