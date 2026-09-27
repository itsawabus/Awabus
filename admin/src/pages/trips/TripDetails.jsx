import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { MapTiles } from '../../components/map/GeofenceMap.jsx';
import usePageHeader from '../../hooks/usePageHeader.js';
import { getTrip } from '../../api/trips.js';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import Card, { CardHeader } from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/ui/Table.jsx';

const stopIcon = (n) =>
  L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:#0b1b2b;color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid white;">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

export default function TripDetails() {
  const { id } = useParams();
  const [tab, setTab] = useState('route');
  const { data: trip, isLoading } = useQuery({ queryKey: ['trip', id], queryFn: () => getTrip(id) });

  usePageHeader({ breadcrumb: ['AwaBus', 'Trip History', trip?.tripCode || '...'] });

  if (isLoading || !trip) return <PageLoader />;

  const stops = trip.stops || [];
  const positions = stops.filter((s) => s.lat && s.lng).map((s) => [s.lat, s.lng]);
  const center = positions[0] || [5.6037, -0.187];

  const attending = trip.studentProgress?.filter((p) => p.attendance !== 'Cancelled').length || 0;
  const droppedOff = trip.studentProgress?.filter((p) => p.dropoffStatus === 'Dropped off').length || 0;
  const onBoard = trip.studentProgress?.filter((p) => p.dropoffStatus === 'On board').length || 0;
  const cancelled = trip.studentProgress?.filter((p) => p.attendance === 'Cancelled').length || 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{trip.tripCode}</h1>
            <Badge>{trip.status === 'In Progress' ? 'In progress' : trip.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {new Date(trip.date).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {trip.departureTime && ` • Started ${trip.departureTime}`}
          </p>
        </div>
        <Button as={Link} to="/trip-history" variant="outline">
          Back to Trip History
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Trip stops" value={`${stops.length} stops`} sub={trip.route?.name} />
        <MiniStat label="Passengers" value={`${trip.studentProgress?.length || 0} registered`} sub={`${trip.bus?.plateNumber || ''}`} />
        <MiniStat label="Distance" value={`${trip.distanceCoveredKm || 0} km covered`} sub="so far" />
        <MiniStat label="ETA" value={trip.etaMinutes ? `${trip.etaMinutes} min` : '—'} sub="time remaining" />
      </div>

      <Tabs
        className="mb-6"
        tabs={[
          { value: 'route', label: 'Route & timeline' },
          { value: 'students', label: 'Student progress' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'route' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader title="Route and drop-off points" subtitle={`${droppedOff} of ${trip.studentProgress?.length || 0} dropped off`} />
            <div className="h-80 px-5 pb-5 sm:h-96">
              <MapContainer center={center} zoom={13} className="h-full w-full">
                <MapTiles />
                {positions.length > 1 && <Polyline positions={positions} color="#0d9488" weight={4} />}
                {stops.map((s, i) => (s.lat && s.lng ? <Marker key={i} position={[s.lat, s.lng]} icon={stopIcon(s.order || i + 1)} /> : null))}
              </MapContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Trip timeline" />
            <div className="space-y-5 p-5">
              {trip.timeline?.length ? (
                trip.timeline.map((ev, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
                      {i < trip.timeline.length - 1 && <span className="mt-1 h-full w-px flex-1 bg-slate-200 dark:bg-slate-700" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-xs font-bold text-slate-400">{ev.time}</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{ev.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{ev.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No timeline events recorded.</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === 'students' && (
        <Card>
          <div className="flex flex-wrap gap-6 border-b border-slate-100 p-5 dark:border-slate-800">
            <ChipStat label="attending" value={attending} />
            <ChipStat label="dropped off" value={droppedOff} />
            <ChipStat label="on board" value={onBoard} />
            <ChipStat label="cancelled" value={cancelled} />
          </div>
          <Table>
            <Thead>
              <Th>Student</Th>
              <Th>Attendance</Th>
              <Th>Alert Status</Th>
              <Th>Alert Time</Th>
              <Th>Drop-off Status</Th>
              <Th className="text-right">Actions</Th>
            </Thead>
            <Tbody>
              {trip.studentProgress?.map((p, i) => (
                <Tr key={i}>
                  <Td className="font-semibold text-slate-900 dark:text-white">
                    {p.student ? `${p.student.firstName} ${p.student.lastName}` : '—'}
                  </Td>
                  <Td>
                    <Badge>{p.attendance}</Badge>
                  </Td>
                  <Td>{p.alertStatus}</Td>
                  <Td>{p.alertTime || '—'}</Td>
                  <Td>{p.dropoffStatus}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant="outline">
                      Notify
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <p className="px-5 pb-5 text-xs text-slate-400">
            * Note: Last recorded trip activities are updated in real-time as GPS coordinates trigger geofence boundaries.
          </p>
        </Card>
      )}
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

const ChipStat = ({ label, value }) => (
  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
    <span className="mr-1.5 rounded-full bg-brand-50 px-2 py-0.5 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{value}</span>
    {label}
  </span>
);
