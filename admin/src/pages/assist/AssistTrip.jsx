import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bus, CheckCircle2, Clock, MessageSquare, Phone, RefreshCw, UserRound } from 'lucide-react';
import { API_URL } from '../../api/client.js';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import Input, { Label, Textarea, Select } from '../../components/ui/Input.jsx';
import { formatPhone } from '../../lib/phone.js';
import { cn } from '../../lib/utils.js';

// Bus assistant page: opened by the teacher on bus duty from the driver's QR
// code. No account; the link's pass works until the trip ends.

const NAME_KEY = 'awabus.assistant.name';
const REASONS = ['Heavy traffic', 'Vehicle breakdown', 'Weather conditions', 'Road closure', 'Other'];
const quickMessages = (first) => [
  `The bus is at the pick-up point now. Please bring ${first} out.`,
  'The bus will reach you in about 5 minutes.',
  'The bus is running a few minutes late today.',
  `${first} was not at the pick-up point. Please call the school office.`,
];

const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
};

function useAssistApi(pass, name) {
  return useMemo(() => {
    const api = axios.create({ baseURL: API_URL, headers: { 'X-Assist-Pass': pass, 'X-Assistant-Name': name } });
    api.interceptors.response.use(
      (r) => r,
      (error) => {
        const err = new Error(error?.response?.data?.message || (error?.response ? error.message : "Can't reach AwaBus. Check your internet connection."));
        err.status = error?.response?.status;
        return Promise.reject(err);
      }
    );
    return api;
  }, [pass, name]);
}

export default function AssistTrip() {
  const { pass } = useParams();
  const [name, setName] = useState(readName);
  const [draftName, setDraftName] = useState(readName);

  useEffect(() => {
    document.title = 'Bus assistant · AwaBus';
  }, []);

  if (!name) {
    return (
      <Shell>
        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-navy-light">
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Bus assistant</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            You can help the driver with this trip: roll call, boarding, messages to parents and delay notices. This page
            stops working when the trip ends.
          </p>
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const clean = draftName.trim();
              if (!clean) return;
              try {
                localStorage.setItem(NAME_KEY, clean);
              } catch {
                /* not remembered: fine */
              }
              setName(clean);
            }}
          >
            <Label htmlFor="assistant-name">Your name</Label>
            <Input id="assistant-name" value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="e.g. Madam Akua" maxLength={40} />
            <p className="text-xs text-slate-400">Shown to the school as who helped on this trip.</p>
            <Button type="submit" className="w-full" disabled={!draftName.trim()}>
              Continue
            </Button>
          </form>
        </div>
      </Shell>
    );
  }
  return <AssistBoard pass={pass} name={name} onChangeName={() => setName('')} />;
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-navy">
      <div className="mx-auto max-w-2xl px-4 py-5">
        <div className="mb-4 flex items-center gap-2">
          <img src="/awabus1.png" alt="AwaBus" className="h-8 w-auto" />
        </div>
        {children}
      </div>
    </div>
  );
}

function AssistBoard({ pass, name, onChangeName }) {
  const api = useAssistApi(pass, name);
  const qc = useQueryClient();
  const key = ['assist-trip', pass];
  const [confirm, setConfirm] = useState(null);
  const [messageTo, setMessageTo] = useState(null);
  const [delayOpen, setDelayOpen] = useState(false);
  const [flash, setFlash] = useState('');

  const { data: trip, error, isLoading, refetch, isFetching } = useQuery({
    queryKey: key,
    queryFn: () => api.get('/assist/trip').then((r) => r.data.data),
    refetchInterval: (q) => (q.state.error ? false : 10000),
    retry: (count, err) => ![401, 410].includes(err?.status) && count < 2,
  });

  const mark = useMutation({
    mutationFn: ({ studentId, body }) => api.post(`/assist/students/${studentId}/attendance`, body).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => setFlash(e.message),
  });

  if (isLoading) {
    return (
      <Shell>
        <p className="py-16 text-center text-sm text-slate-500">Loading the trip…</p>
      </Shell>
    );
  }
  if (error && [401, 410].includes(error.status)) {
    return (
      <Shell>
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-navy-light">
          <CheckCircle2 className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="mt-3 text-lg font-extrabold text-slate-900 dark:text-white">This link no longer works</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{error.message}</p>
        </div>
      </Shell>
    );
  }
  if (!trip) {
    return (
      <Shell>
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-navy-light">
          <p className="text-sm text-red-600">{error?.message || 'Could not load the trip.'}</p>
          <Button className="mt-4" variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </Shell>
    );
  }

  const live = ['In Progress', 'Delayed'].includes(trip.status);
  const rows = trip.studentProgress || [];
  const riding = rows.filter((p) => !['Absent', 'Cancelled'].includes(p.attendance));
  const onBoard = riding.filter((p) => p.dropoffStatus === 'On board').length;
  const dropped = riding.filter((p) => p.dropoffStatus === 'Dropped off').length;

  const ask = (title, message, confirmLabel, run, danger = false) => setConfirm({ title, message, confirmLabel, run, danger });

  return (
    <Shell>
      <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-navy-light">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Bus className="h-3.5 w-3.5" /> Bus assistant
            </p>
            <h1 className="mt-1 truncate text-lg font-extrabold text-slate-900 dark:text-white">{trip.route?.name || 'Trip'}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {[trip.bus?.plateNumber, trip.session === 'morning' ? 'Morning run' : trip.session === 'evening' ? 'Afternoon run' : '', trip.tripCode]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <Badge tone={live ? 'success' : trip.status === 'Scheduled' ? 'neutral' : 'warning'}>
            {trip.status === 'Scheduled' ? 'Not started' : trip.status}
          </Badge>
        </div>

        {trip.driver && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-navy">
            <span className="flex min-w-0 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">Driver: {trip.driver.name}</span>
            </span>
            {trip.driver.phone && (
              <a href={`tel:${trip.driver.phone}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
                <Phone className="h-4 w-4" /> Call
              </a>
            )}
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Riding" value={riding.length} />
          <Stat label="On board" value={onBoard} />
          <Stat label="Dropped off" value={dropped} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDelayOpen(true)} disabled={!live}>
            <Clock className="h-4 w-4" /> Report a delay
          </Button>
          <Button variant="ghost" onClick={() => refetch()} loading={isFetching}>
            {!isFetching && <RefreshCw className="h-4 w-4" />} Refresh
          </Button>
        </div>
        {!live && trip.status === 'Scheduled' && (
          <p className="mt-2 text-xs text-slate-400">The driver hasn&apos;t started the trip yet. You can do the roll call now.</p>
        )}
      </div>

      {flash && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{flash}</span>
          <button type="button" className="font-semibold" onClick={() => setFlash('')}>
            OK
          </button>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {rows.map((p) => (
          <StudentCard
            key={p.student?._id}
            p={p}
            live={live}
            scheduled={trip.status === 'Scheduled'}
            busy={mark.isPending && mark.variables?.studentId === p.student?._id}
            onMessage={() => setMessageTo(p.student)}
            onAction={(label, body, confirmText, danger) =>
              ask(label, confirmText, 'Yes', () => mark.mutate({ studentId: p.student._id, body }), danger)
            }
          />
        ))}
        {rows.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No students on this trip.</p>}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Helping as <span className="font-semibold">{name}</span> ·{' '}
        <button type="button" className="underline" onClick={onChangeName}>
          change
        </button>
      </p>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        cancelLabel="No"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          confirm.run();
          setConfirm(null);
        }}
      />
      <MessageModal api={api} student={messageTo} onClose={() => setMessageTo(null)} />
      <DelayModal api={api} open={delayOpen} trip={trip} onClose={() => setDelayOpen(false)} onSent={() => qc.invalidateQueries({ queryKey: key })} />
    </Shell>
  );
}

const Stat = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 py-2 dark:bg-navy">
    <p className="text-lg font-extrabold text-slate-900 dark:text-white">{value}</p>
    <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
  </div>
);

function StudentCard({ p, live, scheduled, busy, onAction, onMessage }) {
  const s = p.student || {};
  const g = s.primaryGuardian;
  const name = `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student';
  const out = ['Absent', 'Cancelled'].includes(p.attendance);

  let status = p.dropoffStatus;
  if (p.attendance === 'Cancelled') status = 'Cancelled by parent';
  else if (p.attendance === 'Absent') status = 'Not attending';
  else if (status === 'Pending') status = scheduled ? 'Attending' : 'Waiting';

  return (
    <div className={cn('rounded-2xl bg-white p-4 shadow-sm dark:bg-navy-light', out && 'opacity-70')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-900 dark:text-white">{name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {[s.classGrade, g ? `${g.relation && g.relation !== 'Guardian' ? g.relation : 'Parent'}: ${g.firstName || ''} ${g.lastName || ''}`.trim() : '']
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Badge tone={status === 'Dropped off' || status === 'On board' || status === 'Attending' ? 'success' : out || status === 'Not on board' ? 'danger' : 'neutral'}>
          {status}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {scheduled && p.attendance !== 'Cancelled' && (
          <Button
            size="sm"
            variant="outline"
            loading={busy}
            onClick={() =>
              p.attendance === 'Absent'
                ? onAction(`Mark ${name} as attending?`, { attendance: 'Present' }, 'They will be expected on the bus.')
                : onAction(`Mark ${name} as not attending?`, { attendance: 'Absent' }, 'They will not be expected on the bus for this trip.', true)
            }
          >
            {p.attendance === 'Absent' ? 'Attending' : 'Not attending'}
          </Button>
        )}
        {live && !out && p.dropoffStatus === 'Pending' && (
          <>
            <Button size="sm" loading={busy} onClick={() => onAction(`${name} boarded?`, { dropoffStatus: 'On board' }, 'Mark them as on board.')}>
              Board
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction(`${name} is not here?`, { dropoffStatus: 'Not on board' }, 'Mark them as not on board. The school is told.', true)}
            >
              Not here
            </Button>
          </>
        )}
        {live && !out && p.dropoffStatus === 'On board' && (
          <Button size="sm" loading={busy} onClick={() => onAction(`Drop off ${name}?`, { dropoffStatus: 'Dropped off' }, 'Mark them as dropped off.')}>
            Drop off
          </Button>
        )}
        {g?.phone && (
          <span className="ml-auto flex gap-2">
            <a
              href={`tel:${g.phone}`}
              aria-label={`Call ${g.firstName || 'the parent'}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-brand-600 dark:border-slate-700"
            >
              <Phone className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={onMessage}
              aria-label={`Message ${g.firstName || 'the parent'}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-brand-600 dark:border-slate-700"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          </span>
        )}
      </div>
      {g?.phone && <p className="mt-2 text-xs text-slate-400">{formatPhone(g.phone)}</p>}
    </div>
  );
}

function MessageModal({ api, student, onClose }) {
  const [text, setText] = useState('');
  const send = useMutation({ mutationFn: () => api.post(`/assist/students/${student._id}/message`, { text: text.trim() }).then((r) => r.data) });
  useEffect(() => {
    setText('');
    send.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?._id]);
  const first = student?.firstName || 'your child';
  const close = () => {
    setText('');
    send.reset();
    onClose();
  };
  return (
    <Modal
      open={Boolean(student)}
      onClose={close}
      title={`Message ${student?.primaryGuardian?.firstName || 'the parent'}`}
      footer={
        send.isSuccess ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!text.trim()}>
              Send message
            </Button>
          </>
        )
      }
    >
      {send.isSuccess ? (
        <p className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          {send.data?.status === 'sent' ? 'Message sent.' : 'Message saved. It will be sent once SMS is switched on for the school.'}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">Sent as an SMS from AwaBus.</p>
          <div className="space-y-2">
            {quickMessages(first).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setText(m)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200',
                  text === m ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 dark:border-slate-700'
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 140))} placeholder="Or type a short message" />
          <p className="text-right text-xs text-slate-400">{text.length}/140</p>
          {send.isError && <p className="text-sm text-red-600">{send.error.message}</p>}
        </div>
      )}
    </Modal>
  );
}

function DelayModal({ api, open, trip, onClose, onSent }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [message, setMessage] = useState('');
  const send = useMutation({
    mutationFn: () => api.post('/assist/delay-broadcast', { reason, message: message.trim() }).then((r) => r.data),
    onSuccess: onSent,
  });
  const max = trip?.limits?.delay?.maxMessage || 100;
  const close = () => {
    setMessage('');
    send.reset();
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Report a delay"
      footer={
        send.isSuccess ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button onClick={() => send.mutate()} loading={send.isPending}>
              Send to parents
            </Button>
          </>
        )
      }
    >
      {send.isSuccess ? (
        <p className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" /> Delay notice sent to the parents of the children riding.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Every parent with a child riding gets an SMS. At most {trip?.limits?.delay?.perTrip || 3} per trip.
          </p>
          <div>
            <Label>Reason</Label>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Extra message (optional)</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, max))} placeholder="e.g. About 20 minutes late" />
            <p className="mt-1 text-right text-xs text-slate-400">
              {message.length}/{max}
            </p>
          </div>
          {send.isError && <p className="text-sm text-red-600">{send.error.message}</p>}
        </div>
      )}
    </Modal>
  );
}
