import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Phone, Navigation2, AlertTriangle } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import { getTrackingTripDetail } from '../../api/tracking.js';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { PillTabs } from '../../components/ui/Tabs.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/ui/Table.jsx';
import { timeAgo } from '../../lib/utils.js';

export default function LiveTripDetail() {
  const { tripId } = useParams();
  const [filter, setFilter] = useState('all');
  const { data: trip, isLoading } = useQuery({
    queryKey: ['tracking-trip', tripId],
    queryFn: () => getTrackingTripDetail(tripId),
    refetchInterval: 15000,
  });

  usePageHeader({ breadcrumb: ['AwaBus', 'Live Tracking', trip?.tripCode || 'Trip Detail'] });

  if (isLoading || !trip) return <PageLoader />;

  const progress = trip.studentProgress || [];
  const visible = progress.filter((p) => {
    if (filter === 'remaining') return p.dropoffStatus === 'Pending' || p.dropoffStatus === 'On board';
    if (filter === 'absent') return p.attendance === 'Absent' || p.attendance === 'Cancelled';
    return true;
  });
  const alerted = progress.filter((p) => p.alertStatus === 'Alert sent').length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Trip Detail</h1>
            <Badge tone={trip.status === 'Delayed' ? 'warning' : 'success'}>{trip.status === 'In Progress' ? 'Trip in progress' : trip.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {trip.bus?.name} · {trip.bus?.plateNumber} • {trip.route?.name} · stop {Math.min(progress.length, 7)} of {progress.length}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Phone className="h-4 w-4" /> Call driver
          </Button>
          <Button as={Link} to="/live-tracking">
            <Navigation2 className="h-4 w-4" /> Follow on map
          </Button>
        </div>
      </div>

      {trip.gpsSignal !== 'ok' && (
        <Card className="mb-6 border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-bold text-amber-800 dark:text-amber-400">{trip.bus?.plateNumber} has stopped reporting GPS</p>
              <p className="text-sm text-amber-700/90 dark:text-amber-400/80">
                The trip is still marked in progress — the marker shows the last reported location, not the live one.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MiniStat label="Departure" value={trip.departureTime || '—'} sub="On-time departure" />
        <MiniStat label="Duration" value={trip.etaMinutes ? `${trip.etaMinutes} min` : '—'} sub={`Live · ${timeAgo(trip.liveLocation?.updatedAt)}`} />
        <MiniStat label="GPS Updates" value={`${alerted} / ${progress.length}`} sub="Strong satellite lock" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.6fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Trip Assignment" />
            <div className="p-5">
              <p className="font-bold text-slate-800 dark:text-slate-100">
                {trip.driver ? `${trip.driver.firstName} ${trip.driver.lastName} (driver)` : '—'}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {trip.bus?.name} · {trip.bus?.plateNumber}
              </p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{trip.route?.name}</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Last Location" />
            <div className="p-5 text-sm text-slate-500 dark:text-slate-400">
              {Number.isFinite(trip.liveLocation?.lat) && Number.isFinite(trip.liveLocation?.lng) ? (
                <>
                  <p>
                    Lat/Lng: {trip.liveLocation.lat?.toFixed(4)}° N, {trip.liveLocation.lng?.toFixed(4)}° W
                  </p>
                  <p className="mt-1">Last updated {timeAgo(trip.liveLocation.updatedAt)}</p>
                </>
              ) : (
                <p>No location reported yet.</p>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Student Progress"
            subtitle={`${alerted} alerted · ${progress.length - alerted} remaining`}
            action={
              <PillTabs
                tabs={[
                  { value: 'all', label: `All (${progress.length})` },
                  { value: 'remaining', label: 'Remaining' },
                  { value: 'absent', label: 'Absent' },
                ]}
                active={filter}
                onChange={setFilter}
              />
            }
          />
          <Table>
            <Thead>
              <Th>Student</Th>
              <Th>Attendance</Th>
              <Th>Alert Status</Th>
              <Th>Drop-off</Th>
            </Thead>
            <Tbody>
              {visible.map((p, i) => (
                <Tr key={i}>
                  <Td className="font-semibold text-slate-900 dark:text-white">
                    {p.student ? `${p.student.firstName} ${p.student.lastName}` : '—'}
                  </Td>
                  <Td>
                    <Badge>{p.attendance}</Badge>
                  </Td>
                  <Td>{p.alertStatus}</Td>
                  <Td>{p.dropoffStatus}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <p className="px-5 pb-5 text-xs text-slate-400">Showing {visible.length} of {progress.length} students on trip</p>
        </Card>
      </div>
    </div>
  );
}

const MiniStat = ({ label, value, sub }) => (
  <Card className="p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">{value}</p>
    {sub && <p className="text-xs text-slate-400">{sub}</p>}
  </Card>
);
