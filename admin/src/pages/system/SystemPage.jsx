import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Circle,

  Database,
  MessageSquare,
  Radio,
  RefreshCw,
  Send,
  Server,
  Trash2,
  XCircle,
} from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { Label, Select, Textarea } from '../../components/ui/Input.jsx';
import PhoneInput from '../../components/ui/PhoneInput.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { formatPhone } from '../../lib/phone.js';
import { cn, formatDateTime, timeAgo } from '../../lib/utils.js';
import { clearServerErrors, getMessageLog, getServerErrors, getSystemHealth, sendTestSms } from '../../api/system.js';

const TABS = [
  { value: 'health', label: 'Health' },
  { value: 'messaging', label: 'Messaging' },
  { value: 'errors', label: 'Errors' },
];

export default function SystemPage() {
  usePageHeader({ breadcrumb: ['AwaBus', 'System'] });
  const [tab, setTab] = useState('health');
  const health = useQuery({ queryKey: ['superadmin', 'system', 'health'], queryFn: getSystemHealth, refetchInterval: 30000 });

  return (
    <div>
      <PageHeader
        title="System"
        subtitle="Developer tools: server health, outgoing messages and recent errors."
        action={
          <Button variant="outline" onClick={() => health.refetch()} loading={health.isFetching}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />
      <Tabs className="mb-6" tabs={TABS} active={tab} onChange={setTab} />
      {health.isLoading ? (
        <PageLoader label="Checking the server..." />
      ) : health.isError ? (
        <p className="py-16 text-center text-sm text-red-600">Couldn&apos;t reach the server: {health.error.message}</p>
      ) : tab === 'health' ? (
        <HealthTab h={health.data} />
      ) : tab === 'messaging' ? (
        <MessagingTab h={health.data} />
      ) : (
        <ErrorsTab />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ bits */

// State is always icon + words, never colour alone.
function State({ ok, warn, children }) {
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-semibold', ok ? 'text-emerald-700 dark:text-emerald-400' : warn ? 'text-amber-700 dark:text-amber-400' : 'text-red-600 dark:text-red-400')}>
      <Icon className="h-4 w-4 shrink-0" /> {children}
    </span>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-800 dark:text-slate-100">{children}</span>
    </div>
  );
}

const uptime = (s) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

/* ------------------------------------------------------------------ health */

function HealthTab({ h }) {
  const { server, database, realtime, jobs, messaging, errors, config } = h;
  const groups = [...new Set(config.map((c) => c.group))];
  const missingRequired = config.filter((c) => c.required && !c.set);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><Server className="h-4 w-4 text-slate-400" /> Server</p>
          <State ok>Running for {uptime(server.uptimeSeconds)}</State>
          <div className="mt-2">
            <Row label="Version">{server.version}{server.commit ? ` · ${server.commit}` : ''}</Row>
            {server.branch && <Row label="Branch">{server.branch}</Row>}
            <Row label="Mode">{server.env}</Row>
            <Row label="Node">{server.node}</Row>
            <Row label="Memory">{server.memoryMb} MB</Row>
          </div>
        </Card>
        <Card className="p-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><Database className="h-4 w-4 text-slate-400" /> Database</p>
          <State ok={database.state === 'connected' && !database.pingError}>
            {database.state === 'connected' && !database.pingError ? 'Connected' : database.pingError || database.state}
          </State>
          <div className="mt-2">
            <Row label="Database">{database.name}</Row>
            <Row label="Response time">{database.pingMs !== null ? `${database.pingMs} ms` : '—'}</Row>
          </div>
        </Card>
        <Card className="p-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><Radio className="h-4 w-4 text-slate-400" /> Live connections</p>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{realtime.connectedClients}</p>
          <p className="mt-1 text-xs text-slate-500">Admin sites and apps connected for live updates right now.</p>
        </Card>
        <Card className="p-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><AlertOctagon className="h-4 w-4 text-slate-400" /> Server errors</p>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{errors.sinceStart}</p>
          <p className="mt-1 text-xs text-slate-500">
            {errors.latest ? `Latest ${timeAgo(errors.latest.at)}: ${errors.latest.method} ${errors.latest.path}` : 'None since the server started.'}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Background jobs" subtitle="Things the server does on its own" />
          <CardBody className="space-y-5">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Close forgotten trips</p>
                <State ok={jobs.staleTrips.running && !jobs.staleTrips.lastError} warn={!jobs.staleTrips.running}>
                  {jobs.staleTrips.lastError ? 'Failing' : jobs.staleTrips.running ? 'Running' : 'Off'}
                </State>
              </div>
              <p className="mt-1 text-xs text-slate-500">Ends trips still in progress {jobs.staleTrips.hours}+ hours after starting, every {jobs.staleTrips.everyMinutes} minutes.</p>
              <Row label="Last run">{jobs.staleTrips.lastRunAt ? timeAgo(jobs.staleTrips.lastRunAt) : 'Not yet'}</Row>
              <Row label="Trips ended">{jobs.staleTrips.lastEnded} last run · {jobs.staleTrips.totalEnded} since start</Row>
              {jobs.staleTrips.lastError && <p className="mt-1 text-xs text-red-600">{jobs.staleTrips.lastError}</p>}
            </div>
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Demo GPS simulator</p>
                <State ok={!jobs.simulator.running} warn={jobs.simulator.running}>{jobs.simulator.running ? 'On (demo)' : 'Off'}</State>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {jobs.simulator.running
                  ? `Moves buses along their route stops every ${Math.round(jobs.simulator.intervalMs / 1000)}s on any in-progress trip. Switch it off (remove TRIP_SIMULATOR) before real driver-app GPS is used, or it will overwrite real positions.`
                  : 'Moves buses along their route stops for demos. Off unless TRIP_SIMULATOR=true is set; keep it off on a live system.'}
              </p>
              <Row label="Last tick">{jobs.simulator.lastRunAt ? timeAgo(jobs.simulator.lastRunAt) : 'Not yet'}</Row>
              {jobs.simulator.lastError && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Last error {timeAgo(jobs.simulator.lastErrorAt)}: {jobs.simulator.lastError}
                </p>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Messaging" subtitle="How SMS and email leave the platform" />
          <CardBody className="space-y-3">
            <ProviderLine icon={MessageSquare} label="SMS" status={messaging.sms} />
            <ProviderLine icon={MessageSquare} label="Email" status={messaging.email} />
            <Row label="Last 24 hours">{messaging.last24h.total} messages · {messaging.last24h.failed} failed</Row>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Settings"
          subtitle={missingRequired.length ? `${missingRequired.length} required setting${missingRequired.length === 1 ? ' is' : 's are'} missing` : 'Which environment variables the server can see (values are never shown)'}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <tbody>
              {groups.map((g) => (
                <GroupRows key={g} group={g} rows={config.filter((c) => c.group === g)} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function GroupRows({ group, rows }) {
  return (
    <>
      <tr>
        <td colSpan={3} className="bg-slate-50 px-5 py-2 text-xs font-bold uppercase tracking-wide text-slate-400 dark:bg-navy">{group}</td>
      </tr>
      {rows.map((c) => (
        <tr key={c.key} className="border-b border-slate-50 dark:border-slate-800/60">
          <td className="px-5 py-2.5 font-mono text-xs text-slate-800 dark:text-slate-100">
            {c.key}
            {c.required && <span className="ml-2 font-sans text-[11px] font-semibold text-slate-400">required</span>}
          </td>
          <td className="px-5 py-2.5">
            {c.set ? <State ok>Set</State> : c.required ? <State>Missing</State> : <span className="inline-flex items-center gap-1.5 text-sm text-slate-400"><Circle className="h-4 w-4" /> Not set</span>}
          </td>
          <td className="px-5 py-2.5 text-slate-500 dark:text-slate-400">{c.note}</td>
        </tr>
      ))}
    </>
  );
}

function ProviderLine({ icon: Icon, label, status }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><Icon className="h-4 w-4 text-slate-400" /> {label}</span>
        {status.live ? (
          <State ok={!status.sandbox} warn={status.sandbox}>{status.provider === 'arkesel' ? 'Arkesel' : status.provider}{status.sandbox ? ' (sandbox)' : ' (live)'}</State>
        ) : (
          <State warn>Log only, not sent</State>
        )}
      </div>
      {!status.live && <p className="mt-1 text-xs text-slate-500">{status.reason}</p>}
      {status.live && status.sender && <p className="mt-1 text-xs text-slate-500">Sender ID: {status.sender}</p>}
      {status.balance && (
        <p className={cn('mt-1 text-xs', status.balance.ok ? 'text-slate-500' : 'text-red-600')}>
          {status.balance.ok
            ? `Balance: ${status.balance.sms_balance ?? '?'} SMS${status.balance.main_balance !== undefined ? ` · ${status.balance.main_balance} main` : ''}`
            : `Couldn't read the balance: ${status.balance.error}`}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ messaging */

const STATUS_BADGE = {
  sent: { tone: 'success', label: 'Sent' },
  logged: { tone: 'neutral', label: 'Logged only' },
  failed: { tone: 'danger', label: 'Failed' },
};

function MessagingTab({ h }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ channel: '', status: '', purpose: '' });
  const [page, setPage] = useState(1);
  const params = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page };
  const log = useQuery({
    queryKey: ['superadmin', 'system', 'messages', params],
    queryFn: () => getMessageLog(params),
    placeholderData: (prev) => prev,
    refetchInterval: 20000,
  });
  const purposes = log.data?.purposes || {};
  const setFilter = (k) => (e) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader title="Where messages are sent from" subtitle="What is connected today, and what still needs building" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                  <th className="px-5 py-2.5 font-semibold">Message</th>
                  <th className="px-5 py-2.5 font-semibold">Channel</th>
                  <th className="px-5 py-2.5 font-semibold">Fired from</th>
                  <th className="px-5 py-2.5 font-semibold">State</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(purposes).map(([key, p]) => (
                  <tr key={key} className="border-b border-slate-50 dark:border-slate-800/60">
                    <td className="px-5 py-2.5 font-medium text-slate-800 dark:text-slate-100">{p.label}</td>
                    <td className="px-5 py-2.5 text-slate-500">{p.channel}</td>
                    <td className="px-5 py-2.5 text-slate-500">{p.where}</td>
                    <td className="px-5 py-2.5">
                      {!p.wired ? (
                        <State warn>Not built</State>
                      ) : p.on === false ? (
                        <State warn>Off (set {p.switch}=true)</State>
                      ) : (
                        <State ok>Connected</State>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-6">
          <TestSms status={h.messaging.sms} onSent={() => qc.invalidateQueries({ queryKey: ['superadmin', 'system'] })} />
          <ArkeselSetup status={h.messaging.sms} />
        </div>
      </div>

      <Card>
        <CardHeader title="Message log" subtitle="Every SMS and email the platform tried to send, newest first. One-time codes are hidden. Kept for 90 days." />
        <div className="flex flex-wrap gap-3 px-5 pt-4">
          <div className="w-36">
            <Select className="!h-9" value={filters.channel} onChange={setFilter('channel')} aria-label="Channel">
              <option value="">All channels</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </Select>
          </div>
          <div className="w-40">
            <Select className="!h-9" value={filters.status} onChange={setFilter('status')} aria-label="Status">
              <option value="">Any status</option>
              <option value="sent">Sent</option>
              <option value="logged">Logged only</option>
              <option value="failed">Failed</option>
            </Select>
          </div>
          <div className="w-64">
            <Select className="!h-9" value={filters.purpose} onChange={setFilter('purpose')} aria-label="Message type">
              <option value="">All message types</option>
              {Object.entries(purposes).filter(([, p]) => p.wired).map(([k, p]) => (
                <option key={k} value={k}>{p.label}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className={cn('overflow-x-auto p-5 transition-opacity', log.isFetching && log.isPlaceholderData && 'opacity-60')}>
          {log.isLoading ? (
            <PageLoader label="Loading messages..." />
          ) : !log.data?.data.length ? (
            <p className="py-10 text-center text-sm text-slate-500">No messages recorded{Object.values(filters).some(Boolean) ? ' for these filters' : ' yet'}.</p>
          ) : (
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                  <th className="py-2 pr-4 font-semibold">When</th>
                  <th className="py-2 pr-4 font-semibold">Type</th>
                  <th className="py-2 pr-4 font-semibold">To</th>
                  <th className="py-2 pr-4 font-semibold">Message</th>
                  <th className="py-2 pr-4 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody>
                {log.data.data.map((m) => (
                  <tr key={m._id} className="border-b border-slate-50 align-top dark:border-slate-800/60">
                    <td className="whitespace-nowrap py-2.5 pr-4 text-slate-500" title={formatDateTime(m.createdAt)}>{timeAgo(m.createdAt)}</td>
                    <td className="py-2.5 pr-4">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{purposes[m.purpose]?.label || m.purpose}</p>
                      <p className="text-xs text-slate-400">{m.channel.toUpperCase()}{m.schoolName ? ` · ${m.schoolName}` : ''}</p>
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-slate-700 dark:text-slate-200">{m.channel === 'sms' ? formatPhone(m.to) : m.to}</td>
                    <td className="max-w-md py-2.5 pr-4 text-slate-600 dark:text-slate-300">{m.body}</td>
                    <td className="py-2.5 pr-4">
                      <Badge tone={STATUS_BADGE[m.status]?.tone}>{STATUS_BADGE[m.status]?.label || m.status}</Badge>
                      <p className="mt-1 text-xs text-slate-400">
                        {m.provider === 'log' ? 'server log' : m.provider}
                        {m.durationMs ? ` · ${m.durationMs} ms` : ''}
                      </p>
                      {m.error && <p className="mt-1 max-w-xs text-xs text-red-600">{m.error}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {log.data?.meta && (
            <Pagination page={page} totalPages={log.data.meta.totalPages} onChange={setPage} label={`${log.data.meta.total} message${log.data.meta.total === 1 ? '' : 's'}`} />
          )}
        </div>
      </Card>
    </div>
  );
}

function TestSms({ status, onSent }) {
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const send = useMutation({ mutationFn: () => sendTestSms({ to, text }), onSuccess: onSent });
  const r = send.data;
  return (
    <Card>
      <CardHeader title="Send a test SMS" subtitle={status.live ? `Goes out through Arkesel${status.sandbox ? ' in sandbox mode (not delivered)' : ' and uses real credit'}.` : 'No SMS provider is on, so it will only be logged.'} />
      <CardBody className="space-y-4">
        <div>
          <Label htmlFor="test-to">Phone number</Label>
          <PhoneInput id="test-to" value={to} onChange={setTo} />
        </div>
        <div>
          <Label htmlFor="test-text">Message (optional)</Label>
          <Textarea id="test-text" rows={2} maxLength={320} value={text} onChange={(e) => setText(e.target.value)} placeholder="AwaBus test message. If you received this, SMS sending works." />
        </div>
        <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!to}>
          <Send className="h-4 w-4" /> Send test
        </Button>
        {send.isError && <State>{send.error.message}</State>}
        {r && (r.status === 'sent' ? <State ok>Sent{r.providerMessageId ? ` (Arkesel id ${r.providerMessageId})` : ''}</State> : r.status === 'logged' ? <State warn>Logged only: no SMS provider is on</State> : <State>Failed: {r.error}</State>)}
      </CardBody>
    </Card>
  );
}

function ArkeselSetup({ status }) {
  return (
    <Card>
      <CardHeader title="Switching on Arkesel" />
      <CardBody>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>Get an API key and an approved sender ID from the Arkesel dashboard.</li>
          <li>
            On the server (Render environment or <code className="text-xs">server/.env</code>) set <code className="text-xs">ARKESEL_API_KEY</code>, <code className="text-xs">ARKESEL_SENDER_ID</code> and <code className="text-xs">ARKESEL_SANDBOX=true</code>.
          </li>
          <li>Set <code className="text-xs">SMS_PROVIDER=arkesel</code> and restart the server.</li>
          <li>Send a test SMS here and check it shows as Sent, then remove <code className="text-xs">ARKESEL_SANDBOX</code> to deliver for real.</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          Currently: {status.live ? `Arkesel is on${status.sandbox ? ' in sandbox mode' : ''}` : status.reason}.
        </p>
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ errors */

function ErrorsTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['superadmin', 'system', 'errors'], queryFn: getServerErrors, refetchInterval: 15000 });
  const clear = useMutation({ mutationFn: clearServerErrors, onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin', 'system'] }) });
  const entries = q.data?.entries || [];
  return (
    <Card>
      <CardHeader
        title="Recent server errors"
        subtitle="The last 100 requests that failed on the server (HTTP 500), since it last started. Request details that could hold personal data are left out."
        action={
          <Button variant="outline" size="sm" onClick={() => clear.mutate()} disabled={!entries.length} loading={clear.isPending}>
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
        }
      />
      {q.isLoading ? (
        <PageLoader />
      ) : !entries.length ? (
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No server errors since the last restart</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {entries.map((e, i) => (
            <li key={`${e.at}-${i}`} className="px-5 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <Badge tone="danger">{e.status}</Badge>
                <span className="font-mono text-xs text-slate-700 dark:text-slate-200">{e.method} {e.path}</span>
                <span className="text-xs text-slate-400" title={formatDateTime(e.at)}>{timeAgo(e.at)} · {e.role}</span>
              </div>
              <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">{e.message}</p>
              {e.where && <p className="mt-0.5 break-all font-mono text-[11px] text-slate-400">{e.where}</p>}
            </li>
          ))}
        </ul>
      )}
      {q.data && <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400 dark:border-slate-800">{q.data.total} error{q.data.total === 1 ? '' : 's'} since the server started.</p>}
      {q.data?.total > entries.length && entries.length === 100 && <p className="px-5 pb-3 text-xs text-slate-400">Only the latest 100 are kept.</p>}
    </Card>
  );
}
