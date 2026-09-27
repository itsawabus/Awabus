import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useViewSchoolStore } from '../../store/viewSchoolStore.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Inbox, ExternalLink } from 'lucide-react';
import { getPlatformInsights, createSchool, updateSchoolStatus } from '../../api/superadmin.js';
import PhoneInput from '../../components/ui/PhoneInput.jsx';
import { isValidPhone } from '../../lib/phone.js';
import usePageHeader from '../../hooks/usePageHeader.js';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { Input, Label, FieldError, Select } from '../../components/ui/Input.jsx';
import { PillTabs } from '../../components/ui/Tabs.jsx';
import Sparkline from '../../components/charts/Sparkline.jsx';
import { fmtNumber, fmtPct } from '../../components/charts/chartUtils.js';
import {
  KpiTiles,
  TripsChart,
  AttentionList,
  CompareSchools,
  StudentOutcomes,
  FleetStatus,
  StudentGrowth,
} from './PlatformInsights.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/ui/Table.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Modal from '../../components/ui/Modal.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SuperadminDashboard() {
  const navigate = useNavigate();
  const setViewSchool = useViewSchoolStore((st) => st.setSchool);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ schoolName: '', adminName: '', adminEmail: '', adminPhone: '' });
  const [formError, setFormError] = useState('');
  const [statusTarget, setStatusTarget] = useState(null); // school being suspended/reactivated

  usePageHeader({ breadcrumb: ['AwaBus', 'Platform'] });

  const [days, setDays] = useState(30);
  const [focus, setFocus] = useState(''); // '' = the whole platform, else a school id

  const { data, isLoading, isError, error, refetch, isFetching, isPlaceholderData } = useQuery({
    queryKey: ['superadmin', 'insights', days, focus],
    queryFn: () => getPlatformInsights({ days, school: focus }),
    placeholderData: (prev) => prev, // keep the charts on screen while a new range loads
    refetchInterval: 60000,
  });
  const dim = isFetching && isPlaceholderData;

  const openSchool = (id, name) => {
    setViewSchool({ id, name });
    navigate('/');
  };

  const createMutation = useMutation({
    mutationFn: () => createSchool(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin'] });
      setForm({ schoolName: '', adminName: '', adminEmail: '', adminPhone: '' });
      setShowForm(false);
      setFormError('');
    },
    onError: (err) => setFormError(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateSchoolStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin'] });
      setStatusTarget(null);
    },
  });

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.schoolName.trim()) return setFormError('School name is required');
    if (!form.adminName.trim()) return setFormError('Admin name is required');
    if (!EMAIL_REGEX.test(form.adminEmail.trim())) return setFormError('Enter a valid admin email');
    if (!isValidPhone(form.adminPhone)) return setFormError('Enter the admin phone: 10 digits starting with 0, e.g. 024 412 3456');
    createMutation.mutate();
  };

  if (isLoading) return <PageLoader label="Loading platform insights..." />;
  if (isError || !data) {
    // A 404 here means the API server is older than this admin site and has no insights endpoint yet.
    const outdated = /not found/i.test(error?.message || '');
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-sm font-semibold text-red-600">Couldn&apos;t load the platform insights.</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {outdated
            ? 'The server this site is connected to does not have the insights feature yet. Update and restart the API server, then try again.'
            : `The server said: ${error?.message || 'no response'}`}
        </p>
        <Button className="mt-4" variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const schools = data.schools;
  const focused = schools.find((s) => s.id === focus);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Platform Overview</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            How every school is doing, and the platform as a whole.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Add school
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <PillTabs
          tabs={[
            { value: 7, label: 'Last 7 days' },
            { value: 30, label: 'Last 30 days' },
            { value: 90, label: 'Last 90 days' },
          ]}
          active={days}
          onChange={setDays}
        />
        <div className="w-full sm:w-60">
        <Select className="!h-10" value={focus} onChange={(e) => setFocus(e.target.value)} aria-label="School">
          <option value="">All schools</option>
          {schools.map((sc) => (
            <option key={sc.id} value={sc.id}>{sc.name}</option>
          ))}
        </Select>
        </div>
        {focused && (
          <>
            <Button variant="outline" size="sm" className="!h-10" onClick={() => openSchool(focused.id, focused.name)}>
              <ExternalLink className="h-4 w-4" /> Open {focused.name}
            </Button>
            <button type="button" onClick={() => setFocus('')} className="text-sm font-semibold text-slate-500 hover:underline">
              Show all schools
            </button>
          </>
        )}
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader title="Add a new school" />
          <form onSubmit={handleSubmit} className="space-y-5 p-6 pt-0">
            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <Label htmlFor="schoolName" required>School name</Label>
                <Input id="schoolName" value={form.schoolName} onChange={setField('schoolName')} placeholder="e.g. Awa International School" />
              </div>
              <div>
                <Label htmlFor="adminName" required>Admin name</Label>
                <Input id="adminName" value={form.adminName} onChange={setField('adminName')} placeholder="e.g. Ama Mensah" />
              </div>
              <div>
                <Label htmlFor="adminEmail" required>Admin email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={form.adminEmail}
                  onChange={setField('adminEmail')}
                  placeholder="admin@school.edu.gh"
                  error={form.adminEmail.length > 0 && !EMAIL_REGEX.test(form.adminEmail.trim())}
                />
                <FieldError>
                  {form.adminEmail.length > 0 && !EMAIL_REGEX.test(form.adminEmail.trim()) ? 'Enter a valid email address' : ''}
                </FieldError>
              </div>
              <div>
                <Label htmlFor="adminPhone" required>Admin contact number</Label>
                <PhoneInput id="adminPhone" value={form.adminPhone} onChange={(v) => setForm((f) => ({ ...f, adminPhone: v }))} />
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              The admin will be prompted to create their own password the first time they sign in with this email.
            </p>

            <div className="flex gap-3">
              <Button type="submit" loading={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create school'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setFormError(''); }}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <KpiTiles data={data} days={days} schoolName={focused?.name} />

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <TripsChart data={data} days={days} dim={dim} />
        <AttentionList items={data.attention} dim={dim} onOpen={(it) => openSchool(it.schoolId, it.school)} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CompareSchools schools={schools} days={days} selectedId={focus || null} onSelect={(id) => setFocus(id === focus ? '' : id)} dim={dim} />
        <StudentOutcomes schools={schools} days={days} selectedId={focus || null} dim={dim} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <StudentGrowth growth={data.growth} schoolName={focused?.name} dim={dim} />
        <FleetStatus schools={schools} selectedId={focus || null} dim={dim} />
      </div>

      <Card>
        <CardHeader title="Schools" subtitle={`Figures for the last ${days} days where they relate to trips`} />
        {schools.length ? (
          <Table>
            <Thead>
              <Th>School</Th>
              <Th className="text-right">Students</Th>
              <Th className="text-right">Buses</Th>
              <Th>Trips</Th>
              <Th className="text-right">On time</Th>
              <Th className="text-right">Seat use</Th>
              <Th>Last trip</Th>
              <Th>Actions</Th>
            </Thead>
            <Tbody>
              {schools.map((s) => (
                <Tr key={s.id} className={focus === s.id ? 'bg-brand-50/60 dark:bg-brand-500/5' : ''}>
                  <Td>
                    <p className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
                      {s.name}
                      {s.status !== 'Active' && <Badge>{s.status}</Badge>}
                    </p>
                    <p className="text-xs text-slate-400">
                      {s.code} · {s.admins} admin{s.admins === 1 ? '' : 's'}
                      {s.adminsPending ? ` (${s.adminsPending} not signed in yet)` : ''}
                    </p>
                  </Td>
                  <Td className="text-right tabular-nums">{fmtNumber(s.students)}</Td>
                  <Td className="text-right tabular-nums">{fmtNumber(s.buses)}</Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <span className="w-10 text-right tabular-nums">{fmtNumber(s.tripsTotal)}</span>
                      <Sparkline values={s.daily} width={64} height={24} label={`${s.name} trips per day`} />
                    </div>
                  </Td>
                  <Td className="text-right tabular-nums">{fmtPct(s.onTimeRate)}</Td>
                  <Td className={`text-right tabular-nums ${s.seatUse > 100 ? 'font-semibold text-red-600 dark:text-red-400' : ''}`}>{fmtPct(s.seatUse)}</Td>
                  <Td className="whitespace-nowrap">{s.lastTripAt ? new Date(s.lastTripAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Never'}</Td>
                  <Td className="whitespace-nowrap">
                    <button
                      onClick={() => openSchool(s.id, s.name)}
                      className="mr-4 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => setStatusTarget(s)}
                      className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {s.status === 'Active' ? 'Suspend' : 'Reactivate'}
                    </button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <EmptyState icon={Inbox} title="No schools yet" description="Create your first school to get started." />
        )}
      </Card>

      <Modal
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={statusTarget?.status === 'Active' ? 'Suspend this school?' : 'Reactivate this school?'}
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={statusTarget?.status === 'Active' ? 'danger' : 'primary'}
              loading={statusMutation.isPending}
              onClick={() =>
                statusMutation.mutate({
                  id: statusTarget.id,
                  status: statusTarget.status === 'Active' ? 'Suspended' : 'Active',
                })
              }
            >
              {statusTarget?.status === 'Active' ? 'Suspend school' : 'Reactivate school'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {statusTarget?.status === 'Active' ? (
            <>
              <strong className="text-slate-700 dark:text-slate-200">{statusTarget?.name}</strong> will be marked as
              suspended across the platform. This can be undone at any time by reactivating it.
            </>
          ) : (
            <>
              <strong className="text-slate-700 dark:text-slate-200">{statusTarget?.name}</strong> will be marked as
              active again.
            </>
          )}
        </p>
      </Modal>
    </div>
  );
}