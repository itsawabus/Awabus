import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Pencil, MessageSquareText } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import { getStudent } from '../../api/students.js';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Button from '../../components/ui/Button.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { formatDate, formatDateTime } from '../../lib/utils.js';
import { formatPhone } from '../../lib/phone.js';
import { languageLabel } from '../../lib/languages.js';
import { rideSessionLabel } from '../../lib/sessions.js';
import RideCancellationsCard from '../../components/students/RideCancellationsCard.jsx';

const InfoRow = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{value || '—'}</p>
  </div>
);

export default function StudentProfile() {
  const { id } = useParams();
  const [tab, setTab] = useState('info');
  const { data: student, isLoading } = useQuery({ queryKey: ['student', id], queryFn: () => getStudent(id) });

  usePageHeader({ breadcrumb: ['AwaBus', 'Students', student ? `${student.firstName} ${student.lastName}` : '...'] });

  if (isLoading || !student) return <PageLoader />;
  const guardian = student.primaryGuardian;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={`${student.firstName} ${student.lastName}`} src={student.profilePhotoUrl} size="lg" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {student.firstName} {student.lastName}
              </h1>
              <Badge tone={student.status === 'Active' ? 'success' : 'neutral'}>{student.status}</Badge>
              {student.todayStatus && <Badge title="Today, from the driver's roll call and boarding scans">Today: {student.todayStatus}</Badge>}
            </div>
          </div>
        </div>
        <Button as={Link} to={`/students/${id}/edit`} variant="outline">
          <Pencil className="h-4 w-4" /> Edit Student
        </Button>
      </div>

      <Tabs
        className="mb-6"
        tabs={[
          { value: 'info', label: 'Student Information' },
          { value: 'guardian', label: 'Parent/Guardian' },
          { value: 'transport', label: 'Transport Details' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'info' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Student Information" />
            <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
              <InfoRow label="Student ID" value={student.studentCode} />
              <InfoRow label="Class / Grade" value={student.classGrade} />
              <InfoRow label="Gender" value={student.gender} />
              <InfoRow label="Date of Birth" value={formatDate(student.dob)} />
              <InfoRow label="Emergency Phone" value={formatPhone(student.secondContactPhone)} />
              <InfoRow label="Rides" value={rideSessionLabel(student.rideSession)} />
              <InfoRow
                label="Arrival calls"
                value={student.arrivalCalls === false ? 'Off: the parent is not called when the bus nears home' : 'On: the parent is called when the bus nears home'}
              />
              <InfoRow label="Home Address" value={student.homeAddress} className="sm:col-span-2" />
            </div>
          </Card>
          <Card>
            <CardHeader title="Home & Geofence Location" />
            <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
              <InfoRow label="Home Address" value={student.homeAddress} />
              <InfoRow label="Geofence" value={`${student.geofenceRadius || 200}m buffer zone around residence`} />
              <InfoRow label="Latitude" value={student.lat?.toFixed?.(4)} />
              <InfoRow label="Longitude" value={student.lng?.toFixed?.(4)} />
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Shares home with</p>
                {student.householdMembers?.length ? (
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm font-medium">
                    {student.householdMembers.map((m) => (
                      <Link key={m._id} to={`/students/${m._id}`} className="text-brand-600 hover:underline">
                        {m.firstName} {m.lastName}
                      </Link>
                    ))}
                  </p>
                ) : (
                  <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">—</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'info' && (
        <div className="mt-6">
          <RideCancellationsCard student={student} />
        </div>
      )}

      {tab === 'guardian' && (
        <Card>
          <CardHeader title="Parent / Guardian Information" />
          <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
            <InfoRow label="Full Name" value={guardian ? `${guardian.firstName} ${guardian.lastName}` : '—'} />
            <InfoRow label="Relation" value={guardian?.relation} />
            <InfoRow label="Phone" value={formatPhone(guardian?.phone)} />
            <InfoRow label="Email" value={guardian?.email} />
            <InfoRow label="Language for calls" value={guardian ? languageLabel(guardian.preferredLanguage) : '—'} />
            <InfoRow label="Second Contact" value={student.secondContactName} />
            <InfoRow label="Second Contact Phone" value={formatPhone(student.secondContactPhone)} />
            <InfoRow label="Emergency Instructions" value={student.emergencyInstructions} className="sm:col-span-2" />
          </div>
        </Card>
      )}

      {tab === 'transport' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader title="Recent Communications" />
            {student.communications?.length ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {student.communications.map((c, i) => (
                  <div key={i} className="flex gap-3 p-5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                      <MessageSquareText className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{c.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{c.description}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatDateTime(c.occurredAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-5 text-sm text-slate-400">No communications recorded yet.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Transit Association" />
            <div className="space-y-5 p-5">
              <InfoRow label="Assigned Bus" value={student.bus ? `${student.bus.plateNumber} (${student.bus.name})` : '—'} />
              <InfoRow label="Assigned Route" value={student.route?.name} />
              <InfoRow
                label="Assigned Driver"
                value={student.bus?.assignedDriver ? `${student.bus.assignedDriver.firstName} ${student.bus.assignedDriver.lastName}` : '—'}
              />
              <InfoRow label="Pickup Point" value={`${student.pickupPoint || '—'} (${student.pickupTime || '—'})`} />
              <InfoRow label="Drop-off Point" value={`${student.dropoffPoint || '—'} (${student.dropoffTime || '—'})`} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
