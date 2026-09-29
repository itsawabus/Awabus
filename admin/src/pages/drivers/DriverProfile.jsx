import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Pencil, Smartphone } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import { createDriverSetupCode, getDriver } from '../../api/drivers.js';
import SetupCodeBox from '../../components/account/SetupCodeBox.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import OnlineStatus, { lastSeenText } from '../../components/drivers/OnlineStatus.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Button from '../../components/ui/Button.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/ui/Table.jsx';
import { formatDate } from '../../lib/utils.js';
import { formatPhone } from '../../lib/phone.js';

const InfoRow = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{value || '—'}</p>
  </div>
);

export default function DriverProfile() {
  const { id } = useParams();
  const [tab, setTab] = useState('personal');
  const { data: driver, isLoading } = useQuery({ queryKey: ['driver', id], queryFn: () => getDriver(id), refetchInterval: 30000 });

  usePageHeader({ breadcrumb: ['AwaBus', 'Drivers', driver ? `${driver.firstName} ${driver.lastName}` : '...'] });

  if (isLoading || !driver) return <PageLoader />;

  const age = driver.dob
    ? Math.floor((Date.now() - new Date(driver.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={`${driver.firstName} ${driver.lastName}`} src={driver.profilePhotoUrl} size="lg" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {driver.firstName} {driver.lastName}
              </h1>
              <Badge>{driver.status}</Badge>
              <OnlineStatus driver={driver} />
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Driver Profile &amp; Assigned Assets · {driver.online ? 'Driver app open now' : lastSeenText(driver)}
            </p>
          </div>
        </div>
        <Button as={Link} to={`/drivers/${id}/edit`} variant="outline">
          <Pencil className="h-4 w-4" /> Edit Details
        </Button>
      </div>

      <Tabs
        className="mb-6"
        tabs={[
          { value: 'personal', label: 'Personal Information' },
          { value: 'license', label: 'License Information' },
          { value: 'assignments', label: 'Assignments' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'personal' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.4fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader title="Driver Information" />
              <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
                <InfoRow label="Phone" value={formatPhone(driver.phone)} />
                <InfoRow label="Email" value={driver.email} />
                <InfoRow label="Date of birth" value={driver.dob ? `${formatDate(driver.dob)} (${age} years)` : '—'} />
                <InfoRow label="Gender" value={driver.gender} />
                <InfoRow
                  label="Emergency contact"
                  value={
                    driver.emergencyContactName
                      ? `${driver.emergencyContactName} (${driver.emergencyContactRelation}) - ${formatPhone(driver.emergencyContactPhone)}`
                      : '—'
                  }
                />
                <InfoRow label="Residential address" value={driver.residentialAddress} />
              </div>
            </Card>
            <DriverAppAccess driver={driver} />
          </div>
          <AssignmentHistoryCard driver={driver} />
        </div>
      )}

      {tab === 'license' && (
        <Card>
          <CardHeader title="License Information" />
          <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
            <InfoRow label="License number" value={driver.licenseNumber} />
            <InfoRow label="Expiry date" value={formatDate(driver.licenseExpiry)} />
            <InfoRow label="License class" value={driver.licenseClass} />
            <InfoRow
              label="Status"
              value={
                driver.licenseExpiry && new Date(driver.licenseExpiry) < new Date()
                  ? 'Expired - update the expiry date'
                  : 'Details saved'
              }
            />
          </div>
        </Card>
      )}

      {tab === 'assignments' && <AssignmentHistoryCard driver={driver} full />}
    </div>
  );
}

// Whether the driver has set up the driver app, and a way to hand them a
// (new) setup code when they have not.
function DriverAppAccess({ driver }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState(null);
  const mutation = useMutation({
    mutationFn: () => createDriverSetupCode(driver._id),
    onSuccess: (res) => {
      setCode(res);
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
  return (
    <Card>
      <CardHeader title="Driver App" />
      <div className="space-y-3 p-5 text-sm">
        {driver.accountSetUp ? (
          <p className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Set up: the driver has chosen a password
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
              <Smartphone className="h-4 w-4 shrink-0" /> Not set up yet
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              To sign in the first time, the driver needs a setup code from you. Making a new code cancels any older one.
            </p>
            {code ? (
              <SetupCodeBox code={code.setupCode} expires={code.setupCodeExpires}>
                Give this code to {driver.firstName}. They enter it with their phone number in the driver app.
              </SetupCodeBox>
            ) : (
              <Button variant="outline" onClick={() => mutation.mutate()} loading={mutation.isPending}>
                Create setup code
              </Button>
            )}
            {mutation.isError && <p className="text-red-600">{mutation.error.message}</p>}
          </>
        )}
      </div>
    </Card>
  );
}

function AssignmentHistoryCard({ driver, full }) {
  return (
    <Card className={full ? '' : undefined}>
      <CardHeader title="Assignment History" />
      {driver.assignmentHistory?.length ? (
        <Table>
          <Thead>
            <Th>Date</Th>
            <Th>Bus</Th>
            <Th>Route</Th>
            <Th>Status</Th>
          </Thead>
          <Tbody>
            {driver.assignmentHistory.map((a, i) => (
              <Tr key={i}>
                <Td>
                  {formatDate(a.from)} - {a.to ? formatDate(a.to) : 'Present'}
                </Td>
                <Td>{a.bus ? `${a.bus.name} (${a.bus.plateNumber})` : '—'}</Td>
                <Td>{a.route ? a.route.name : '—'}</Td>
                <Td>
                  <Badge>{a.status}</Badge>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-slate-400">No assignment history yet.</p>
      )}
    </Card>
  );
}
