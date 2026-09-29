import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell } from 'lucide-react';
import Card, { CardBody, CardHeader } from '../ui/Card.jsx';
import Spinner from '../ui/Spinner.jsx';
import { getNotificationPreferences, updateNotificationPreferences } from '../../api/notifications.js';
import { cn } from '../../lib/utils.js';

const PREFS_KEY = ['notification-preferences'];

/** Account settings card: switch each kind of notification on or off. */
export default function NotificationSettings({ id }) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: PREFS_KEY, queryFn: getNotificationPreferences });

  // The switch flips straight away; the change is saved in the background.
  // Saves run one after another (scope), so quick clicks are stored in order.
  const save = useMutation({
    mutationFn: updateNotificationPreferences,
    scope: { id: 'notification-preferences' },
    onError: () => qc.invalidateQueries({ queryKey: PREFS_KEY }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const toggle = (key) => {
    const current = qc.getQueryData(PREFS_KEY);
    const next = { ...current, types: current.types.map((t) => (t.key === key ? { ...t, enabled: !t.enabled } : t)) };
    qc.setQueryData(PREFS_KEY, next);
    save.mutate(next.types.filter((t) => !t.enabled).map((t) => t.key));
  };

  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader title="Notifications" subtitle="Choose what shows up under the bell at the top of the page." />
      <CardBody className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="text-sm text-red-600">Couldn&apos;t load your notification settings.</p>
        ) : (
          data.categories.map((cat) => {
            const types = data.types.filter((t) => t.category === cat.key);
            if (!types.length) return null;
            const critical = cat.key === 'critical';
            return (
              <div key={cat.key}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{cat.label}</p>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                  {types.map((t) => (
                    <div key={t.key} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="flex items-start gap-3">
                        {critical ? (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                        ) : (
                          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.label}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{t.description}</p>
                          {critical && !t.enabled && (
                            <p className="mt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                              Off: you won&apos;t be told about this safety alert.
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={t.enabled}
                        aria-label={t.label}
                        onClick={() => toggle(t.key)}
                        className={cn(
                          'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150',
                          t.enabled ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-150',
                            t.enabled ? 'left-[22px]' : 'left-0.5'
                          )}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
        {save.isError && (
          <p className="text-sm text-red-600">Couldn&apos;t save that change, so it was put back. Check your connection and try again.</p>
        )}
      </CardBody>
    </Card>
  );
}
