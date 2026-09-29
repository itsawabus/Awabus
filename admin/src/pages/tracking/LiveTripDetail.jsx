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
import { formatLat, formatLng, gpsFreshness } from '../../lib/gps.js';
import useNow from '../../hooks/useNow.js';
import { GpsState } from './LiveTracking.jsx';
import { ConnectionPair } from '../../components/buses/BusOnlineStatus.jsx';
import { runWords, sessionLabel, statusLabel } from '../../lib/sessions.js';

export default function LiveTripDetail() {
  const { tripId } = useParams();
  const [filter, setFilter] = useState('all');
  const { data: trip, isLoading } = useQuery({
    queryKey: ['tracking-trip', tripId],
    queryFn: () => getTrackingTripDetail(tripId),
    refetchInterval: 15000,
  });

  usePageHeader({ breadcrumb: ['AwaBus', 'Live Tracking', trip?.tripCode || 'Trip Detail'] });
  const now = useNow(15000);

  if (isLoading || !trip) return <PageLoader />;

  const progress = trip.studentProgress || [];
  const visible = progress.filter((p) => {
    if (filter === 'remaining') return p.dropoffStatus === 'Pending' || p.dropoffStatus === 'On board';
    if (filter === 'absent') return p.attendance === 'Absent' || p.attendance === 'Cancelled';
    return true;
  });
  const gps = gpsFreshness(trip.liveLocation, now);
  const running = trip.status === 'In Progress' || trip.status === 'Delayed';
  const alerted = progress.filter((p) => p.alertStatus === 'Sent').length;
  const scanned = progress.filter((p) => p.dropoffStatus === 'On board' || p.dropoffStatus === 'Dropped off').length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Trip Detail</h1>
            <Badge tone={trip.status === 'Delayed' ? 'warning' : 'success'}>{trip.status === 'In Progress' ? 'Trip in progress' : trip.status}</Badge>
            {trip.session && <Badge>{sessionLabel(trip.session)}</Badge>}
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

      {running && (gps.state === 'stale' || gps.state === 'lost') && (
        <Card className="mb-6 border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-bold text-amber-800 dark:text-amber-400">
                {trip.bus?.plateNumber} {gps.state === 'lost' ? 'has stopped reporting GPS' : 'has not reported its position recently'}
              </p>
              <p className="text-sm text-amber-700/90 dark:text-amber-400/80">{gps.detail}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MiniStat label="Departure" value={trip.departureTime || '—'} sub="On-time departure" />
        <MiniStat label="Duration" value={trip.etaMinutes ? `${trip.etaMinutes} min` : '—'} sub={gps.label} />
        <MiniStat label="Students scanned" value={`${scanned} / ${progress.length}`} sub={`${runWords(trip.session).board} or ${runWords(trip.session).drop.toLowerCase()}`} />
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
              <ConnectionPair className="mt-3" busOnline={trip.busOnline} driverOnline={trip.driverOnline} hasDriver={Boolean(trip.driver)} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Last Location" />
            <div className="p-5 text-sm text-slate-500 dark:text-slate-400">
              {Number.isFinite(trip.liveLocation?.lat) && Number.isFinite(trip.liveLocation?.lng) ? (
                <>
                  <p>
                    Lat/Lng: {formatLat(trip.liveLocation.lat)}, {formatLng(trip.liveLocation.lng)}
                  </p>
                  <GpsState gps={gps} />
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
            subtitle={`${scanned} scanned · parents texted for ${alerted}`}
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
              <Th>Parent alert</Th>
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
                  <Td>
                    <span className={p.alertStatus === 'Failed' ? 'font-semibold text-red-600 dark:text-red-400' : ''}>{p.alertStatus}</span>
                    {p.alertTime && p.alertStatus !== 'Not yet alerted' && <span className="block text-xs text-slate-400">{p.alertTime}</span>}
                    {p.nearHomeAt && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        Bus near home {new Date(p.nearHomeAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        {p.nearHomeAlert && p.nearHomeAlert !== 'Sent' ? ` · ${p.nearHomeAlert}` : p.nearHomeAlert === 'Sent' ? ' · parent texted' : ''}
                      </span>
                    )}
                  </Td>
                  <Td>{statusLabel(trip.session, p.dropoffStatus)}</Td>
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
