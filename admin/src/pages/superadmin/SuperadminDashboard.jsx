import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { School as SchoolIcon, Users, GraduationCap, Bus, Plus, Inbox } from 'lucide-react';
import { getSuperadminAnalytics, createSchool, updateSchoolStatus } from '../../api/superadmin.js';
import PhoneInput from '../../components/ui/PhoneInput.jsx';
import { isValidPhone } from '../../lib/phone.js';
import usePageHeader from '../../hooks/usePageHeader.js';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { Input, Label, FieldError } from '../../components/ui/Input.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/ui/Table.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Modal from '../../components/ui/Modal.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SuperadminDashboard() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ schoolName: '', adminName: '', adminEmail: '', adminPhone: '' });
  const [formError, setFormError] = useState('');
  const [statusTarget, setStatusTarget] = useState(null); // school being suspended/reactivated

  usePageHeader({ breadcrumb: ['AwaBus', 'Platform'] });

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-analytics'],
    queryFn: getSuperadminAnalytics,
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: () => createSchool(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-analytics'] });
      setForm({ schoolName: '', adminName: '', adminEmail: '', adminPhone: '' });
      setShowForm(false);
      setFormError('');
    },
    onError: (err) => setFormError(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateSchoolStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-analytics'] });
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

  if (isLoading) return <PageLoader label="Loading platform analytics..." />;

  const stats = data?.stats || {};
  const schools = data?.schools || [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Platform Overview</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage schools and monitor activity across the entire AwaBus platform.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Add school
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Schools" value={stats.totalSchools ?? 0} hint={`${stats.activeSchools ?? 0} active`} icon={SchoolIcon} />
        <StatCard label="School Admins" value={stats.totalAdmins ?? 0} hint="Across all tenants" icon={Users} tone="slate" />
        <StatCard label="Total Students" value={stats.totalStudents ?? 0} hint={`${stats.totalRoutes ?? 0} routes configured`} icon={GraduationCap} tone="amber" />
        <StatCard label="Total Buses" value={stats.totalBuses ?? 0} hint={`${stats.totalDrivers ?? 0} drivers registered`} icon={Bus} />
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

      <Card>
        <CardHeader title="Schools" />
        {schools.length ? (
          <Table>
            <Thead>
              <Th>School</Th>
              <Th>Students</Th>
              <Th>Buses</Th>
              <Th>Drivers</Th>
              <Th>Admins</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </Thead>
            <Tbody>
              {schools.map((s) => (
                <Tr key={s.id}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{s.name}</Td>
                  <Td>{s.students}</Td>
                  <Td>{s.buses}</Td>
                  <Td>{s.drivers}</Td>
                  <Td>{s.admins}</Td>
                  <Td><Badge>{s.status}</Badge></Td>
                  <Td>
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