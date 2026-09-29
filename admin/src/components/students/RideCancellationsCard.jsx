import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarX, Phone, Undo2 } from 'lucide-react';
import Card, { CardHeader } from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import { cancelRide, getRideCancellations, undoRideCancellation } from '../../api/students.js';
import { formatDate } from '../../lib/utils.js';

const RUN = { morning: 'Morning pick-up', evening: 'Afternoon drop-off' };
const CHOICES = [
  { value: 'morning', label: 'Morning pick-up', rides: ['both', 'morning'] },
  { value: 'evening', label: 'Afternoon drop-off', rides: ['both', 'evening'] },
  { value: 'both', label: 'Both', rides: ['both'] },
];

const dayLabel = (key) => {
  const today = new Date().toISOString().slice(0, 10);
  if (key === today) return 'Today';
  const d = new Date(`${key}T12:00:00Z`);
  return `${d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })}, ${formatDate(d)}`;
};

/**
 * Upcoming ride cancellations for a student, and buttons for the office to
 * cancel the next morning pick-up, afternoon drop-off, or both (as a parent
 * can by phone: keys 1, 2 and 3). No cut-off: it is always the next run of
 * that kind that has not started yet.
 */
export default function RideCancellationsCard({ student }) {
  const qc = useQueryClient();
  const key = ['ride-cancellations', student._id];
  const [confirm, setConfirm] = useState(null);
  const { data: rows = [], isLoading } = useQuery({ queryKey: key, queryFn: () => getRideCancellations(student._id) });

  const add = useMutation({
    mutationFn: (choice) => cancelRide(student._id, choice),
    onSuccess: (res) => qc.setQueryData(key, res.data),
  });
  const undo = useMutation({
    mutationFn: (id) => undoRideCancellation(student._id, id),
    onSuccess: (data) => qc.setQueryData(key, data),
  });

  const rides = student.rideSession || 'both';
  const choices = CHOICES.filter((c) => c.rides.includes(rides));
  const error = add.error?.message || undo.error?.message;

  return (
    <Card>
      <CardHeader
        title="Ride cancellations"
        subtitle="Parents cancel by phone (1 morning, 2 afternoon, 3 both). The office can do it here too."
      />
      <div className="space-y-4 p-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Cancel the next</p>
          <div className="flex flex-wrap gap-2">
            {choices.map((c) => (
              <Button
                key={c.value}
                size="sm"
                variant="outline"
                loading={add.isPending && add.variables === c.value}
                onClick={() =>
                  setConfirm({
                    choice: c.value,
                    title: `Cancel the next ${c.value === 'both' ? 'pick-up and drop-off' : c.label.toLowerCase()}?`,
                  })
                }
              >
                <CalendarX className="h-4 w-4" /> {c.label}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Today&apos;s run if the bus has not set off yet, otherwise the next school day.
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Upcoming</p>
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No rides cancelled.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {rows.map((r) => (
                <li key={r._id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{RUN[r.session]}</span>
                  <span className="text-slate-500 dark:text-slate-400">{dayLabel(r.date)}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    {r.source === 'phone' ? (
                      <>
                        <Phone className="h-3 w-3" /> by the parent
                      </>
                    ) : (
                      'by the office'
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => undo.mutate(r._id)}
                    disabled={undo.isPending}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline disabled:opacity-50"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Undo
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={`${student.firstName} will be listed as "Cancelled" on that trip and the parent won't get an arrival call for it.`}
        confirmLabel="Cancel ride"
        cancelLabel="Keep it"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          add.mutate(confirm.choice);
          setConfirm(null);
        }}
      />
    </Card>
  );
}
