import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bus, CheckCircle2, CheckSquare, Circle, Clock, CornerUpRight, ListChecks, MessageSquare, Monitor, Moon, Navigation, Phone, RefreshCw, Search, Sun, UserRound, X } from 'lucide-react';
import { API_URL } from '../../api/client.js';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import Input, { Label, Textarea, Select } from '../../components/ui/Input.jsx';
import { formatPhone } from '../../lib/phone.js';
import { cn } from '../../lib/utils.js';
import { runWords, sessionLabel, statusLabel } from '../../lib/sessions.js';
import useBackupLocation from './useBackupLocation.js';
import BackupLocationCard from './BackupLocationCard.jsx';
import { orderTrip, sectionsFor, matchesSearch, callInfo, formatDistance, CALL_IN_PROGRESS } from '../../lib/nearest.js';

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

// The teacher's own light / dark choice: follows the phone unless they pick one.
const ASSIST_THEME_KEY = 'awabus.assist.theme';
const THEMES = [
  { value: 'system', label: 'Phone setting', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];
function useAssistTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(ASSIST_THEME_KEY) || 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && Boolean(media?.matches));
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1b2b' : '#f1f5f9');
    };
    apply();
    media?.addEventListener?.('change', apply);
    return () => media?.removeEventListener?.('change', apply);
  }, [theme]);
  const choose = (next) => {
    setTheme(next);
    try {
      localStorage.setItem(ASSIST_THEME_KEY, next);
    } catch {
      /* not remembered: fine */
    }
  };
  return [theme, choose];
}

function Shell({ children }) {
  const [theme, setTheme] = useAssistTheme();
  const current = THEMES.find((t) => t.value === theme) || THEMES[0];
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-navy dark:text-slate-100">
      <div className="mx-auto max-w-2xl px-4 py-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <img src="/awabus1.png" alt="AwaBus" className="h-8 w-auto" />
          <button
            type="button"
            onClick={() => setTheme(next.value)}
            title={`Theme: ${current.label}. Tap for ${next.label}.`}
            aria-label={`Theme: ${current.label}. Switch to ${next.label}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm dark:bg-navy-light dark:text-slate-300"
          >
            <current.Icon className="h-3.5 w-3.5" /> {current.label}
          </button>
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
  const [search, setSearch] = useState('');
  const [view, setView] = useState(null); // 'nearest' | 'az' (null = pick for the trip's state)
  // Selecting several students: a status for all of them, or one SMS to their parents.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]); // student ids
  const [groupMessage, setGroupMessage] = useState(null); // students
  const [bulkBusy, setBulkBusy] = useState(false);
  const lastOrder = useRef({ order: [], bus: null });

  const { data: trip, error, isLoading, refetch, isFetching } = useQuery({
    queryKey: key,
    queryFn: () => api.get('/assist/trip').then((r) => r.data.data),
    // Faster while a parent's phone is ringing, so the call result shows quickly.
    refetchInterval: (q) =>
      q.state.error ? false : q.state.data?.studentProgress?.some((p) => CALL_IN_PROGRESS.includes(p.callStatus)) ? 5000 : 10000,
    retry: (count, err) => ![401, 410].includes(err?.status) && count < 2,
  });

  // Students' photos: fetched once (they are large), not with every refresh.
  const { data: photos = {} } = useQuery({
    queryKey: ['assist-photos', pass],
    queryFn: () => api.get('/assist/photos').then((r) => r.data.data || {}),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  // The teacher's phone as a backup bus position (hooks must run before any early return).
  const backup = useBackupLocation(api, pass, ['In Progress', 'Delayed'].includes(trip?.status));

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

  // Nearest first from the bus's last position; the order holds still while
  // a dialog is open, so nothing moves under a tap.
  const frozen = Boolean(confirm || messageTo || selecting || groupMessage);
  // The teacher's own position (when sharing) is the freshest view of where the bus is.
  const ownFix =
    backup.on && backup.position && Date.now() - backup.position.at < 60000 && backup.state !== 'not_on_bus' && !(backup.position.accuracy > 100)
      ? backup.position
      : null;
  const bus = frozen ? lastOrder.current.bus : ownFix || trip.liveLocation || null;
  const ordered = orderTrip({ progress: rows, session: trip.session, bus, previous: lastOrder.current.order });
  lastOrder.current = { order: ordered.order, bus };
  const shownView = view || (live ? 'nearest' : 'az');
  const searching = search.trim().length > 0;
  const sections = sectionsFor(trip.session)
    .map((sec) => ({ ...sec, rows: ordered[sec.key].filter((r) => matchesSearch(r.p, search)) }))
    .filter((sec) => sec.rows.length);
  const nameOf = (p) => `${p.student?.firstName || ''} ${p.student?.lastName || ''}`.trim();
  const azRows = [...rows].sort((a, b) => nameOf(a).localeCompare(nameOf(b))).filter((p) => matchesSearch(p, search));
  const nextUp = ordered.next[0];
  const toggle = (id) => setSelected((was) => (was.includes(id) ? was.filter((x) => x !== id) : [...was, id]));
  const stopSelecting = () => {
    setSelecting(false);
    setSelected([]);
  };
  const selectedRows = rows.filter((p) => selected.includes(p.student?._id));
  const w = runWords(trip.session);
  const riderRow = (p) => !['Absent', 'Cancelled'].includes(p.attendance);
  const waitingRow = (p) => !p.dropoffStatus || ['Pending', 'Boarding now'].includes(p.dropoffStatus);
  const BULK = {
    'On board': { word: w.board, fits: (p) => riderRow(p) && (waitingRow(p) || p.dropoffStatus === 'Not on board'), body: { dropoffStatus: 'On board' } },
    'Dropped off': { word: w.drop, fits: (p) => riderRow(p) && p.dropoffStatus === 'On board', body: { dropoffStatus: 'Dropped off' } },
    'Not on board': { word: w.notHere, fits: (p) => riderRow(p) && waitingRow(p), body: { dropoffStatus: 'Not on board' }, danger: true },
    Present: { word: 'Attending', fits: (p) => p.attendance === 'Absent', body: { attendance: 'Present' } },
    Absent: { word: 'Not attending', fits: (p) => p.attendance !== 'Absent' && p.attendance !== 'Cancelled', body: { attendance: 'Absent' }, danger: true },
  };
  const askBulk = (stepKey) => {
    const step = BULK[stepKey];
    const fits = selectedRows.filter(step.fits);
    const skipped = selectedRows.length - fits.length;
    if (!fits.length) {
      setFlash(`None of the selected students can be marked "${step.word}".`);
      return;
    }
    ask(
      `Mark ${fits.length} student${fits.length === 1 ? '' : 's'} as "${step.word}"?`,
      `${fits.map((p) => p.student?.firstName).join(', ')}.${skipped ? ` ${skipped} other${skipped === 1 ? '' : 's'} selected can't be marked "${step.word}" and stay as they are.` : ''}`,
      'Yes',
      async () => {
        setBulkBusy(true);
        const failed = [];
        // One after another, so the changes never clash on the server.
        for (const p of fits) {
          try {
            // eslint-disable-next-line no-await-in-loop
            await api.post(`/assist/students/${p.student._id}/attendance`, step.body);
          } catch (e) {
            failed.push(`${p.student?.firstName}: ${e.message}`);
          }
        }
        setBulkBusy(false);
        stopSelecting();
        qc.invalidateQueries({ queryKey: key });
        if (failed.length) setFlash(`Not saved for ${failed.join('; ')}`);
      },
      step.danger
    );
  };
  // Google Maps turn-by-turn directions to a child's home (opens the Maps app on phones).
  const directionsUrl = (st) =>
    Number.isFinite(st?.lat) && Number.isFinite(st?.lng)
      ? `https://www.google.com/maps/dir/?api=1&destination=${st.lat},${st.lng}&travelmode=driving`
      : '';
  const renderCard = (p, distance = '', withDirections = false) => (
    <Selectable key={p.student?._id} selecting={selecting} isSelected={selected.includes(p.student?._id)} onToggle={() => toggle(p.student?._id)}>
    <StudentCard
      p={p}
      directions={withDirections ? directionsUrl(p.student) : ''}
      photo={photos[p.student?._id]}
      distance={distance}
      session={trip.session}
      live={live}
      scheduled={trip.status === 'Scheduled'}
      busy={mark.isPending && mark.variables?.studentId === p.student?._id}
      onMessage={() => setMessageTo(p.student)}
      onAction={(label, body, confirmText, danger) =>
        ask(label, confirmText, 'Yes', () => mark.mutate({ studentId: p.student._id, body }), danger)
      }
    />
    </Selectable>
  );

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
              {[sessionLabel(trip.session), trip.bus?.name || trip.bus?.plateNumber, trip.tripCode]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge tone={live ? 'success' : trip.status === 'Scheduled' ? 'neutral' : 'warning'}>
              {trip.status === 'Scheduled' ? 'Not started' : trip.status}
            </Badge>
            {/* This page reaching AwaBus: the driver sees the same connected / disconnected. */}
            <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', error ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400')}>
              <span className={cn('h-2 w-2 rounded-full', error ? 'bg-red-500' : 'bg-emerald-500')} />
              {error ? 'Not connected' : 'Connected'}
            </span>
          </div>
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
          <Stat label={runWords(trip.session).board} value={onBoard} />
          <Stat label={runWords(trip.session).drop} value={dropped} />
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

      {(live || trip.status === 'Scheduled') && <BackupLocationCard backup={backup} />}

      {flash && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{flash}</span>
          <button type="button" className="font-semibold" onClick={() => setFlash('')}>
            OK
          </button>
        </div>
      )}

      {live && nextUp && shownView === 'nearest' && !searching && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-navy px-4 py-3 text-white dark:bg-brand-700">
          <Navigation className="h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-300">
              {trip.session === 'evening' ? 'Next drop-off' : trip.session === 'morning' ? 'Next pick-up' : 'Next'}
            </p>
            <p className="truncate font-extrabold">
              {nameOf(nextUp.p)}
              {nextUp.metres != null ? ` · ${formatDistance(nextUp.metres)}` : nextUp.noHome ? ' · no home location saved' : ''}
            </p>
          </div>
          {directionsUrl(nextUp.p.student) && (
            <a
              href={directionsUrl(nextUp.p.student)}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-bold text-navy"
            >
              <CornerUpRight className="h-4 w-4" /> Directions
            </a>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-white p-1 shadow-sm dark:bg-navy-light" role="tablist">
          {[
            { value: 'nearest', label: 'Nearest first', Icon: Navigation },
            { value: 'az', label: 'Attendance list (A–Z)', Icon: ListChecks },
          ].map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={shownView === value}
              onClick={() => setView(value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold',
                shownView === value ? 'bg-navy text-white' : 'text-slate-600 dark:text-slate-300'
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold shadow-sm',
            selecting ? 'bg-navy text-white' : 'bg-white text-slate-700 dark:bg-navy-light dark:text-slate-200'
          )}
        >
          <CheckSquare className="h-3.5 w-3.5" /> {selecting ? 'Done selecting' : 'Select'}
        </button>
        <label className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm dark:bg-navy-light">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, class or parent..."
            aria-label="Search students"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          {searching && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          )}
        </label>
      </div>

      {shownView === 'nearest' ? (
        <div className="mt-3 space-y-4">
          {live && !bus && ordered.next.length > 1 && (
            <p className="text-xs text-slate-500">Waiting for the bus position to put the nearest child first.</p>
          )}
          {sections.map((sec) => (
            <div key={sec.key} className="space-y-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {sec.title} · {sec.rows.length}
              </p>
              {sec.rows.map((r) =>
                renderCard(r.p, sec.key === 'next' && live ? (r.metres != null ? `${formatDistance(r.metres)} away` : r.noHome ? 'No home location saved' : '') : '', sec.key === 'next' && live)
              )}
            </div>
          ))}
          {sections.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">{searching ? 'No student matches that search.' : 'No students on this trip.'}</p>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Everyone on the trip A–Z. This list never re-sorts.</p>
          {trip.status === 'Scheduled' ? (
            <div className="space-y-2">{azRows.map((p) => renderCard(p))}</div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm dark:divide-slate-800 dark:bg-navy-light">
              {azRows.map((p) => (
                <Selectable key={p.student?._id} selecting={selecting} isSelected={selected.includes(p.student?._id)} onToggle={() => toggle(p.student?._id)} flat>
                  <AzRow p={p} session={trip.session} photo={photos[p.student?._id]} />
                </Selectable>
              ))}
            </div>
          )}
          {azRows.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">{searching ? 'No student matches that search.' : 'No students on this trip.'}</p>
          )}
        </div>
      )}

      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-4 pb-4 pt-3 shadow-lg dark:border-slate-700 dark:bg-navy-light">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                {selected.length ? `${selected.length} selected` : 'Tap students to select them'}
              </p>
              <div className="flex gap-4 text-sm font-semibold text-brand-600">
                <button
                  type="button"
                  onClick={() =>
                    setSelected((shownView === 'nearest' ? sections.flatMap((sec) => sec.rows.map((r) => r.p)) : azRows).map((p) => p.student?._id).filter(Boolean))
                  }
                >
                  Select all
                </button>
                <button type="button" onClick={stopSelecting}>
                  Cancel
                </button>
              </div>
            </div>
            {selected.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {live ? (
                  <>
                    <Button size="sm" loading={bulkBusy} onClick={() => askBulk('On board')}>
                      {w.board}
                    </Button>
                    <Button size="sm" loading={bulkBusy} onClick={() => askBulk('Dropped off')}>
                      {w.drop}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => askBulk('Not on board')}>
                      {w.notHere}
                    </Button>
                  </>
                ) : trip.status === 'Scheduled' ? (
                  <>
                    <Button size="sm" loading={bulkBusy} onClick={() => askBulk('Present')}>
                      Attending
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => askBulk('Absent')}>
                      Not attending
                    </Button>
                  </>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => setGroupMessage(selectedRows.map((p) => p.student).filter(Boolean))}>
                  <MessageSquare className="h-4 w-4" /> SMS parents
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <p className={cn('mt-6 text-center text-xs text-slate-400', selecting && 'pb-36')}>
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
      <GroupMessageModal
        api={api}
        students={groupMessage}
        session={trip.session}
        onClose={(sent) => {
          setGroupMessage(null);
          if (sent) stopSelecting();
        }}
      />
      <DelayModal api={api} open={delayOpen} trip={trip} onClose={() => setDelayOpen(false)} onSent={() => qc.invalidateQueries({ queryKey: key })} />
    </Shell>
  );
}

// While selecting, a tap on a student adds or removes them (their own buttons pause).
function Selectable({ selecting, isSelected, onToggle, flat = false, children }) {
  if (!selecting) return children;
  return (
    <div
      role="checkbox"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), onToggle())}
      className={cn('relative cursor-pointer', !flat && 'rounded-2xl', isSelected && (flat ? 'bg-brand-50 dark:bg-brand-500/10' : 'ring-2 ring-brand-600'))}
    >
      <div className="pointer-events-none">{children}</div>
      <span className="absolute right-3 top-3">
        {isSelected ? <CheckCircle2 className="h-5 w-5 text-brand-600" /> : <Circle className="h-5 w-5 text-slate-300" />}
      </span>
    </div>
  );
}

const groupQuickMessages = (session) => [
  session === 'evening' ? 'The bus has left school and is on the way home.' : 'The bus is on the way to your pick-up point.',
  'The bus will reach you in about 5 minutes.',
  'The bus is running a few minutes late today.',
  session === 'evening' ? 'Please be ready to meet your child at the drop-off point.' : 'Please have your child ready at the pick-up point.',
];

/** One SMS to the parents of several students (each parent once). */
function GroupMessageModal({ api, students, session, onClose }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  useEffect(() => {
    setText('');
    setResult(null);
  }, [students]);
  const list = students || [];
  const noPhone = list.filter((s) => !s.primaryGuardian?.phone);
  const seen = new Set();
  const byParent = list.filter((s) => {
    const phone = s.primaryGuardian?.phone;
    if (!phone || seen.has(phone)) return false;
    seen.add(phone);
    return true;
  });
  const send = async () => {
    setSending(true);
    const out = { sent: 0, saved: 0, failed: noPhone.map((s) => `${s.firstName}: no parent phone`) };
    for (const s of byParent) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const r = await api.post(`/assist/students/${s._id}/message`, { text: text.trim() });
        if (r.data?.status === 'sent') out.sent += 1;
        else out.saved += 1;
      } catch (e) {
        out.failed.push(`${s.firstName}: ${e.message}`);
      }
    }
    setSending(false);
    setResult(out);
  };
  const close = () => !sending && onClose(Boolean(result));
  return (
    <Modal
      open={Boolean(students)}
      onClose={close}
      title={`Message ${byParent.length} parent${byParent.length === 1 ? '' : 's'}`}
      footer={
        result ? (
          <Button onClick={() => onClose(true)}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={close} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={send} loading={sending} disabled={!text.trim() || !byParent.length}>
              Send to {byParent.length} parent{byParent.length === 1 ? '' : 's'}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2 font-medium text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            {result.sent ? `Sent to ${result.sent} parent${result.sent === 1 ? '' : 's'}.` : ''}
            {result.saved ? ` ${result.saved} saved: they go out once SMS is switched on for the school.` : ''}
          </p>
          {result.failed.map((f) => (
            <p key={f} className="text-red-600">
              {f}
            </p>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            For {list.map((s) => s.firstName).join(', ')}. Sent as an SMS from AwaBus; brothers and sisters share one message.
          </p>
          <div className="space-y-2">
            {groupQuickMessages(session).map((m) => (
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
          {noPhone.length > 0 && <p className="text-xs text-amber-700">No parent phone for {noPhone.map((s) => s.firstName).join(', ')}.</p>}
        </div>
      )}
    </Modal>
  );
}

const CALL_TONE = {
  info: 'text-brand-600 dark:text-brand-400',
  good: 'text-emerald-700 dark:text-emerald-400',
  bad: 'text-red-600 dark:text-red-400',
  plain: 'text-slate-500 dark:text-slate-400',
};

// One line of the fixed A–Z attendance list.
function AzRow({ p, session, photo }) {
  const s = p.student || {};
  const name = `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student';
  const call = callInfo(p);
  let status = statusLabel(session, p.dropoffStatus || 'Pending');
  let tone = 'text-slate-500 dark:text-slate-400';
  if (p.attendance === 'Cancelled') status = 'Cancelled by parent';
  else if (p.attendance === 'Absent') status = 'Absent';
  else if (p.dropoffStatus === 'Dropped off') {
    tone = 'text-emerald-700 dark:text-emerald-400';
    if (p.autoMarked) status += ' (automatic)';
  }
  else if (p.dropoffStatus === 'On board') tone = 'text-brand-600 dark:text-brand-400';
  else if (p.dropoffStatus === 'Not on board') tone = 'text-red-600 dark:text-red-400';
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar name={name} src={photo} size="sm" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{name}</p>
        {s.classGrade && <p className="truncate text-xs text-slate-400">{s.classGrade}</p>}
        {call && <p className={cn('text-xs font-bold', CALL_TONE[call.tone])}>{call.text}</p>}
      </div>
      <span className={cn('shrink-0 text-right text-sm font-bold', tone)}>{status}</span>
    </div>
  );
}

const Stat = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 py-2 dark:bg-navy">
    <p className="text-lg font-extrabold text-slate-900 dark:text-white">{value}</p>
    <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
  </div>
);

function StudentCard({ p, photo, directions, distance, session, live, scheduled, busy, onAction, onMessage }) {
  const w = runWords(session);
  const s = p.student || {};
  const g = s.primaryGuardian;
  const name = `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student';
  const out = ['Absent', 'Cancelled'].includes(p.attendance);

  let status = statusLabel(session, p.dropoffStatus);
  if (p.dropoffStatus === 'Dropped off' && p.autoMarked) status += ' (automatic)';
  if (p.attendance === 'Cancelled') status = 'Cancelled by parent';
  else if (p.attendance === 'Absent') status = 'Not attending';
  else if (p.dropoffStatus === 'Pending' && scheduled) status = 'Attending';

  const call = callInfo(p);

  return (
    <div className={cn('rounded-2xl bg-white p-4 shadow-sm dark:bg-navy-light', out && 'opacity-70')}>
      <div className="flex items-start justify-between gap-3">
        <Avatar name={name} src={photo} size="md" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-slate-900 dark:text-white">{name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {[s.classGrade, g ? `${g.relation && g.relation !== 'Guardian' ? g.relation : 'Parent'}: ${g.firstName || ''} ${g.lastName || ''}`.trim() : '']
              .filter(Boolean)
              .join(' · ')}
          </p>
          {(distance || directions) && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="whitespace-nowrap">{distance}</span>
              {directions && (
                <a href={directions} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-bold text-brand-600">
                  <CornerUpRight className="h-3.5 w-3.5" /> Directions
                </a>
              )}
            </p>
          )}
          {call && <p className={cn('mt-0.5 text-xs font-bold', CALL_TONE[call.tone])}>{call.text}</p>}
        </div>
        <Badge tone={['Dropped off', 'On board'].includes(p.dropoffStatus) && !out ? 'success' : status === 'Attending' ? 'success' : out || p.dropoffStatus === 'Not on board' ? 'danger' : 'neutral'}>
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
            <Button size="sm" loading={busy} onClick={() => onAction(`${name}: ${w.board.toLowerCase()}?`, { dropoffStatus: 'On board' }, `Mark them as ${w.board.toLowerCase()}.`)}>
              {w.board}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction(`${name}: ${w.notHere.toLowerCase()}?`, { dropoffStatus: 'Not on board' }, `Mark them as ${w.notHere.toLowerCase()}. The school is told.`, true)}
            >
              {w.notHere}
            </Button>
          </>
        )}
        {live && !out && p.dropoffStatus === 'On board' && (
          <Button size="sm" loading={busy} onClick={() => onAction(`${name}: ${w.drop.toLowerCase()}?`, { dropoffStatus: 'Dropped off' }, `Mark them as ${w.drop.toLowerCase()}.`)}>
            {w.drop}
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
          <CheckCircle2 className="h-4 w-4" /> Delay notice sent to the parents still waiting.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {trip?.session === 'morning' ? 'Parents of children still waiting to be picked up get an SMS.' : 'Parents of children not yet dropped home get an SMS.'} Children already {trip?.session === 'morning' ? 'picked up' : 'dropped'} are left out. At most {trip?.limits?.delay?.perTrip || 3} per trip.
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
