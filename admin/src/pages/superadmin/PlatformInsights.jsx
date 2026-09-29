import { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Info,
  Minus,
  XCircle,

} from 'lucide-react';
import Card from '../../components/ui/Card.jsx';
import { PillTabs } from '../../components/ui/Tabs.jsx';
import { ChartCard, Legend } from '../../components/charts/ChartParts.jsx';
import StackedColumns from '../../components/charts/StackedColumns.jsx';
import HBarChart from '../../components/charts/HBarChart.jsx';
import StackedRows from '../../components/charts/StackedRows.jsx';
import AreaTrend from '../../components/charts/AreaTrend.jsx';
import Sparkline from '../../components/charts/Sparkline.jsx';
import { fmtDay, fmtNumber, fmtPct } from '../../components/charts/chartUtils.js';
import { cn } from '../../lib/utils.js';

export const TRIP_SERIES = [
  { key: 'onTime', label: 'On time', color: 'var(--viz-good)', icon: CheckCircle2 },
  { key: 'delayed', label: 'Delayed', color: 'var(--viz-warning)', icon: Clock },
  { key: 'autoEnded', label: 'Not ended by driver', color: 'var(--viz-neutral)', icon: Minus },
  { key: 'cancelled', label: 'Cancelled', color: 'var(--viz-critical)', icon: XCircle },
];
const STUDENT_SERIES = [
  { key: 'carried', label: 'Carried', color: 'var(--viz-good)', icon: CheckCircle2 },
  { key: 'absent', label: 'Absent', color: 'var(--viz-compare)' },
  { key: 'notOnBoard', label: 'Not on board', color: 'var(--viz-critical)', icon: AlertOctagon },
  { key: 'notRecorded', label: 'Not recorded', color: 'var(--viz-neutral)', icon: Minus },
];
const FLEET_SERIES = [
  { key: 'Active', label: 'Active', color: 'var(--viz-good)', icon: CheckCircle2 },
  { key: 'Idle', label: 'Idle', color: 'var(--viz-neutral)', icon: Minus },
  { key: 'Maintenance', label: 'Maintenance', color: 'var(--viz-warning)', icon: AlertTriangle },
];

/* ------------------------------------------------------------------ tiles */

function Delta({ now, before, unit = '%', points = false }) {
  if (now === null || now === undefined || before === null || before === undefined || (!points && !before)) {
    return <span className="text-xs text-slate-400">No earlier period to compare</span>;
  }
  const diff = points ? Math.round((now - before) * 10) / 10 : Math.round(((now - before) / before) * 100);
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-semibold',
        diff > 0 ? 'text-emerald-700 dark:text-emerald-400' : diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {diff > 0 ? '+' : ''}
      {diff}
      {points ? ' pts' : unit} <span className="font-normal text-slate-400">vs previous period</span>
    </span>
  );
}

function Tile({ label, value, children, trend, trendLabel }) {
  return (
    <Card className="flex min-w-0 flex-col justify-between gap-2 p-4">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">{value}</p>
        {trend && <Sparkline values={trend} width={80} label={trendLabel} />}
      </div>
      <div className="min-h-[1.25rem] text-xs text-slate-500 dark:text-slate-400">{children}</div>
    </Card>
  );
}

function Meter({ value }) {
  const v = value ?? 0;
  const tone = v > 100 ? 'bg-red-600' : v > 90 ? 'bg-amber-500' : 'bg-brand-600';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100 dark:bg-brand-500/15" role="meter" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label="Seat use">
      <div className={cn('h-full rounded-full', tone)} style={{ width: `${Math.min(v, 100)}%` }} />
    </div>
  );
}

export function KpiTiles({ data, days, schoolName }) {
  const t = data.totals;
  const dailyTotals = data.daily.map((d) => d.onTime + d.delayed + d.autoEnded + d.cancelled);
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {schoolName ? (
        <Tile label="School" value={<span className="text-lg sm:text-2xl">{schoolName}</span>}>
          {t.suspendedSchools ? 'Suspended' : 'Active'} · {fmtNumber(t.admins)} admin{t.admins === 1 ? '' : 's'}
          {t.adminsPending ? ` (${t.adminsPending} never signed in)` : ''}
        </Tile>
      ) : (
        <Tile label="Schools" value={fmtNumber(t.schools)}>
          {t.activeSchools} active{t.suspendedSchools ? ` · ${t.suspendedSchools} suspended` : ''}
        </Tile>
      )}
      <Tile label="Students" value={fmtNumber(t.students)} trend={data.growth.map((g) => g.total)} trendLabel="Students over the last 12 weeks">
        +{fmtNumber(t.studentsNew)} new in the last {days} days
      </Tile>
      <Tile label={`Trips, last ${days} days`} value={fmtNumber(t.tripsTotal)} trend={dailyTotals} trendLabel="Trips per day">
        <Delta now={t.tripsTotal} before={t.prevTripsTotal} />
      </Tile>
      <Tile label="On time" value={fmtPct(t.onTimeRate)}>
        <Delta now={t.onTimeRate} before={t.prevOnTimeRate} points />
      </Tile>
      <Tile label="Seat use" value={fmtPct(t.seatUse)}>
        <Meter value={t.seatUse} />
        <p className="mt-1">
          {fmtNumber(t.seatsUsed)} of {fmtNumber(t.capacity)} seats taken
        </p>
      </Tile>
      <Tile label="Buses" value={fmtNumber(t.buses)}>
        {t.busStatus.Maintenance ? `${t.busStatus.Maintenance} in maintenance · ` : ''}
        {t.routes} routes{t.routesNoBus ? `, ${t.routesNoBus} without a bus` : ''}
      </Tile>
      <Tile label="Drivers" value={fmtNumber(t.drivers)}>
        {t.licenseExpired || t.licenseSoon
          ? `${t.licenseExpired ? `${t.licenseExpired} expired` : ''}${t.licenseExpired && t.licenseSoon ? ' · ' : ''}${t.licenseSoon ? `${t.licenseSoon} expiring soon` : ''} license${t.licenseExpired + t.licenseSoon === 1 ? '' : 's'}`
          : 'All licenses in date'}
      </Tile>
      <Tile label="Live now" value={fmtNumber(t.liveNow)}>
        {t.liveNow ? 'trips running right now' : 'No trips running right now'}
      </Tile>
    </div>
  );
}

/* ------------------------------------------------------------------ charts */

export function TripsChart({ data, days, dim }) {
  const rows = data.daily.map((d) => ({ ...d, total: d.onTime + d.delayed + d.autoEnded + d.cancelled }));
  const any = rows.some((r) => r.total);
  return (
    <ChartCard
      className="xl:col-span-2"
      title="Trips per day"
      subtitle={`What happened on each trip over the last ${days} days`}
      legend={<Legend items={TRIP_SERIES} />}
      dim={dim}
      table={{
        columns: [
          { key: 'day', label: 'Day', format: (v) => fmtDay(v, { weekday: 'short', day: 'numeric', month: 'short' }) },
          ...TRIP_SERIES.map((s) => ({ key: s.key, label: s.label, align: 'right' })),
          { key: 'total', label: 'Total', align: 'right' },
        ],
        rows: [...rows].reverse(),
      }}
    >
      {any ? (
        <StackedColumns data={rows} series={TRIP_SERIES} height={300} ariaLabel={`Trips per day for the last ${days} days`} />
      ) : (
        <p className="py-16 text-center text-sm text-slate-500">No trips in this period.</p>
      )}
    </ChartCard>
  );
}

const SEVERITY = {
  critical: { icon: AlertOctagon, className: 'text-red-600 dark:text-red-400', label: 'Critical' },
  serious: { icon: AlertTriangle, className: 'text-orange-600 dark:text-orange-400', label: 'Serious' },
  warning: { icon: AlertCircle, className: 'text-amber-600 dark:text-amber-400', label: 'Warning' },
  info: { icon: Info, className: 'text-slate-500', label: 'Info' },
};

export function AttentionList({ items, onOpen, dim }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 7);
  const counts = items.reduce((c, i) => ({ ...c, [i.severity]: (c[i.severity] || 0) + 1 }), {});
  return (
    <Card className={cn('flex flex-col transition-opacity', dim && 'opacity-60')}>
      <div className="px-5 pt-5">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Needs attention</h3>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {items.length
            ? Object.entries(SEVERITY)
                .filter(([k]) => counts[k])
                .map(([k, v]) => `${counts[k]} ${v.label.toLowerCase()}`)
                .join(' · ')
            : 'Checked every school'}
        </p>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nothing needs attention right now</p>
        </div>
      ) : (
        <ul className="mt-3 max-h-[19rem] flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {shown.map((it, i) => {
            const sev = SEVERITY[it.severity];
            return (
              <li key={`${it.schoolId}-${i}`} className="flex items-start gap-3 px-5 py-2.5">
                <sev.icon className={cn('mt-0.5 h-4 w-4 shrink-0', sev.className)} aria-label={sev.label} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 dark:text-slate-100">{it.text}</p>
                  <p className="text-xs text-slate-400">{it.school}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpen(it)}
                  className="shrink-0 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                >
                  Open
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 7 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="border-t border-slate-100 py-3 text-sm font-semibold text-brand-600 hover:bg-slate-50 dark:border-slate-800 dark:text-brand-400 dark:hover:bg-navy"
        >
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </Card>
  );
}

const METRICS = [
  { value: 'students', label: 'Students', get: (s) => s.students, fmt: fmtNumber },
  { value: 'trips', label: 'Trips', get: (s) => s.tripsTotal, fmt: fmtNumber },
  { value: 'onTime', label: 'On time', get: (s) => s.onTimeRate, fmt: fmtPct, pct: true },
  { value: 'seatUse', label: 'Seat use', get: (s) => s.seatUse, fmt: fmtPct, pct: true },
  { value: 'absence', label: 'Absence', get: (s) => s.absenceRate, fmt: fmtPct, pct: true, note: 'lower is better' },
];

// Platform-wide figure for the reference line: a weighted rate, or the average per school.
function platformAverage(metric, schools) {
  const sum = (f) => schools.reduce((n, s) => n + f(s), 0);
  const ratio = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
  switch (metric) {
    case 'onTime': return ratio(sum((s) => s.trips.onTime), sum((s) => s.trips.onTime + s.trips.delayed));
    case 'seatUse': return ratio(sum((s) => s.studentsWithBus), sum((s) => s.capacity));
    case 'absence': return ratio(sum((s) => s.studentOutcomes.absent), sum((s) => s.rostered));
    case 'students': return schools.length ? Math.round(sum((s) => s.students) / schools.length) : null;
    default: return schools.length ? Math.round(sum((s) => s.tripsTotal) / schools.length) : null;
  }
}

export function CompareSchools({ schools, days, selectedId, onSelect, dim }) {
  const [metric, setMetric] = useState('onTime');
  const m = METRICS.find((x) => x.value === metric);
  const rows = useMemo(
    () =>
      schools
        .map((s) => ({ id: s.id, label: s.status === 'Active' ? s.name : `${s.name} (${s.status.toLowerCase()})`, value: m.get(s) }))
        .sort((a, b) => (b.value ?? -1) - (a.value ?? -1)),
    [schools, m]
  );
  const avg = platformAverage(metric, schools);
  return (
    <ChartCard
      title="Compare schools"
      subtitle={`${m.label}${['trips', 'onTime', 'absence'].includes(metric) ? `, last ${days} days` : ''}${m.note ? ` (${m.note})` : ''}. Click a school to focus on it.`}
      dim={dim}
      table={{
        columns: [
          { key: 'label', label: 'School' },
          { key: 'value', label: m.label, align: 'right', format: (v) => m.fmt(v) },
        ],
        rows,
      }}
    >
      <PillTabs className="mb-4" tabs={METRICS} active={metric} onChange={setMetric} />
      <HBarChart
        rows={rows}
        highlightId={selectedId}
        average={avg}
        format={m.fmt}
        maxValue={m.pct ? 100 : undefined}
        onSelect={(r) => onSelect(r.id)}
        ariaLabel={`Schools compared by ${m.label.toLowerCase()}`}
      />
    </ChartCard>
  );
}

export function StudentOutcomes({ schools, days, selectedId, dim }) {
  const rows = schools.filter((s) => s.rostered).map((s) => ({ id: s.id, label: s.name, parts: s.studentOutcomes }));
  return (
    <ChartCard
      title="Students on trips"
      subtitle={`Every student place on a trip in the last ${days} days, by what the driver recorded`}
      legend={<Legend items={STUDENT_SERIES} />}
      dim={dim}
      table={{
        columns: [
          { key: 'label', label: 'School' },
          ...STUDENT_SERIES.map((s) => ({ key: s.key, label: s.label, align: 'right' })),
        ],
        rows: rows.map((r) => ({ id: r.id, label: r.label, ...r.parts })),
      }}
    >
      {rows.length ? (
        <StackedRows rows={rows} series={STUDENT_SERIES} highlightId={selectedId} ariaLabel="Student outcomes per school" />
      ) : (
        <p className="py-12 text-center text-sm text-slate-500">No student records on trips in this period.</p>
      )}
    </ChartCard>
  );
}

export function FleetStatus({ schools, selectedId, dim }) {
  const rows = schools.filter((s) => s.buses).map((s) => ({ id: s.id, label: s.name, parts: s.busStatus }));
  return (
    <ChartCard
      title="Fleet status"
      subtitle="Every bus on the platform, by its current status"
      legend={<Legend items={FLEET_SERIES} />}
      dim={dim}
      table={{
        columns: [
          { key: 'label', label: 'School' },
          ...FLEET_SERIES.map((s) => ({ key: s.key, label: s.label, align: 'right' })),
        ],
        rows: rows.map((r) => ({ id: r.id, label: r.label, ...r.parts })),
      }}
    >
      {rows.length ? (
        <StackedRows rows={rows} series={FLEET_SERIES} unit="buses" highlightId={selectedId} ariaLabel="Bus status per school" />
      ) : (
        <p className="py-12 text-center text-sm text-slate-500">No buses registered yet.</p>
      )}
    </ChartCard>
  );
}

export function StudentGrowth({ growth, schoolName, dim }) {
  const added = growth.reduce((n, g) => n + g.added, 0);
  return (
    <ChartCard
      title="Students on the platform"
      subtitle={`${schoolName || 'All schools'}: ${added ? `+${fmtNumber(added)}` : 'no new students'} in the last 12 weeks`}
      dim={dim}
      table={{
        columns: [
          { key: 'week', label: 'Week of', format: (v) => fmtDay(v, { day: 'numeric', month: 'short', year: 'numeric' }) },
          { key: 'added', label: 'Added', align: 'right' },
          { key: 'total', label: 'Total', align: 'right' },
        ],
        rows: [...growth].reverse(),
      }}
    >
      <AreaTrend
        data={growth}
        valueKey="total"
        label="students"
        ariaLabel="Students on the platform over the last 12 weeks"
        extra={(d) => <p className="mt-0.5 text-slate-400">+{d.added} added that week</p>}
      />
    </ChartCard>
  );
}

