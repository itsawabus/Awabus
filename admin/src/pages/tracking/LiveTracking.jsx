import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapTiles } from '../../components/map/GeofenceMap.jsx';
import { Layers, Navigation2, MapPin as MapPinIcon } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import { useSocketEvent } from '../../hooks/useSocket.js';
import { getTrackingOverview } from '../../api/tracking.js';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { PillTabs } from '../../components/ui/Tabs.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { timeAgo } from '../../lib/utils.js';
import { formatPhone } from '../../lib/phone.js';

const busIcon = (color) =>
  L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;border-radius:9999px;background:${color};display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M4 17V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9a1.5 1.5 0 0 1-1.5 1.5H18a2 2 0 0 1-4 0H10a2 2 0 0 1-4 0H5.5A1.5 1.5 0 0 1 4 17Z"/></svg></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

const colorForStatus = (item) => {
  if (item.gpsSignal !== 'ok') return '#94a3b8';
  if (item.status === 'Delayed') return '#f59e0b';
  return '#0d9488';
};

// Trips without a GPS fix yet have an empty liveLocation ({}), so only treat a
// location as usable when both coordinates are real numbers.
const toLatLng = (loc) =>
  loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng) ? [loc.lat, loc.lng] : null;

function RecenterOnSelect({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom(), { animate: true });
  }, [position, map]);
  return null;
}

export default function LiveTracking() {
  usePageHeader({ breadcrumb: ['AwaBus', 'Live Tracking'] });
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [liveBuses, setLiveBuses] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ['tracking-overview'],
    queryFn: getTrackingOverview,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (data?.data) {
      setLiveBuses(data.data);
      if (!selectedTripId && data.data.length) setSelectedTripId(data.data[0].tripId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useSocketEvent('bus:location', ({ tripId, location }) => {
    setLiveBuses((prev) => prev.map((b) => (b.tripId === tripId ? { ...b, liveLocation: location, gpsSignal: 'ok' } : b)));
  });

  const filtered = useMemo(() => {
    if (filter === 'active') return liveBuses.filter((b) => b.status !== 'Delayed' && b.gpsSignal === 'ok');
    if (filter === 'delayed') return liveBuses.filter((b) => b.status === 'Delayed');
    if (filter === 'offline') return liveBuses.filter((b) => b.gpsSignal !== 'ok');
    return liveBuses;
  }, [liveBuses, filter]);

  const counts = data?.counts || { all: 0, active: 0, delayed: 0, offline: 0 };
  const selected = liveBuses.find((b) => b.tripId === selectedTripId);
  const selectedLat = selected?.liveLocation?.lat;
  const selectedLng = selected?.liveLocation?.lng;
  // Memoised so the map only recentres when the selected bus actually moves.
  const selectedPos = useMemo(() => toLatLng({ lat: selectedLat, lng: selectedLng }), [selectedLat, selectedLng]);
  const center = selectedPos || [5.6037, -0.187];

  if (isLoading) return <PageLoader label="Loading live tracking..." />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Live Tracking</h1>
          <Badge tone={liveBuses.length ? 'success' : 'neutral'}>{liveBuses.length} buses active</Badge>
        </div>
        <p className="text-sm text-slate-400">Monitoring: positions refresh every 15s</p>
      </div>

      <PillTabs
        className="mb-5"
        tabs={[
          { value: 'all', label: `All buses (${counts.all})` },
          { value: 'active', label: `Active (${counts.active})` },
          { value: 'delayed', label: `Delayed (${counts.delayed})` },
          { value: 'offline', label: `Offline (${counts.offline})` },
        ]}
        active={filter}
        onChange={setFilter}
      />

      {liveBuses.length === 0 ? (
        <Card>
          <EmptyState
            icon={Navigation2}
            title="No Active Trips"
            description="Buses appear on the map as soon as a driver starts a trip from the AwaBus driver app. Positions then refresh every 15 seconds."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
          <Card className="relative overflow-hidden">
            <div className="absolute left-4 top-4 z-[400] flex gap-2">
              <button className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold shadow dark:bg-navy-light dark:text-slate-200">
                <Layers className="h-3.5 w-3.5" /> Layers
              </button>
              <button className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white shadow">
                <Navigation2 className="h-3.5 w-3.5" /> Follow bus
              </button>
            </div>
            <div className="h-[520px] w-full">
              <MapContainer center={center} zoom={13} className="h-full w-full" zoomControl={false}>
                <MapTiles />
                <RecenterOnSelect position={selectedPos} />
                {filtered.map((b) => {
                  const pos = toLatLng(b.liveLocation);
                  if (!pos) return null;
                  const routePath = (b.route?.stops || []).filter((s) => s.lat && s.lng).map((s) => [s.lat, s.lng]);
                  return (
                    <div key={b.tripId}>
                      {routePath.length > 1 && <Polyline positions={routePath} color="#cbd5e1" weight={3} />}
                      <Marker
                        position={pos}
                        icon={busIcon(colorForStatus(b))}
                        eventHandlers={{ click: () => setSelectedTripId(b.tripId) }}
                      />
                    </div>
                  );
                })}
              </MapContainer>
            </div>
            <div className="absolute bottom-4 left-4 z-[400] rounded-xl bg-white p-3 text-xs shadow dark:bg-navy-light">
              <p className="mb-2 font-bold text-slate-600 dark:text-slate-200">MAP LEGEND</p>
              <LegendRow color="#0d9488" label="Active Trip" />
              <LegendRow color="#f59e0b" label="Delayed" />
              <LegendRow color="#94a3b8" label="GPS Signal Lost" />
              <LegendRow color="#334155" label="Offline" />
            </div>
          </Card>

          <div>
            {selected ? (
              <Card className="p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Selected Bus</p>
                <div className="mt-1 flex items-center justify-between">
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">{selected.bus?.name}</h3>
                  <Badge tone={selected.gpsSignal === 'ok' ? 'success' : 'neutral'}>{selected.status}</Badge>
                </div>
                <p className="text-sm text-slate-400">
                  Plate: {selected.bus?.plateNumber} · {selected.bus?.capacity} Seater
                </p>

                <div className="my-4 h-px bg-slate-100 dark:bg-slate-800" />
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  {selected.driver ? `${selected.driver.firstName} ${selected.driver.lastName}` : '—'}
                </p>
                <p className="text-sm text-slate-400">Driver · {formatPhone(selected.driver?.phone)}</p>

                <div className="my-4 h-px bg-slate-100 dark:bg-slate-800" />
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Route Details</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="font-bold text-slate-800 dark:text-slate-100">{selected.route?.name}</p>
                  <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">{selected.etaMinutes || 0}m running</span>
                </div>
                <p className="text-sm text-slate-400">Departure: {selected.departureTime || '—'}</p>

                <div className="my-4 h-px bg-slate-100 dark:bg-slate-800" />
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">GPS Signal</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {selected.gpsSignal === 'ok'
                    ? `Last GPS update: ${timeAgo(selected.liveLocation?.updatedAt)}`
                    : 'No signal reported'}
                </p>

                <Button className="mt-6 w-full" onClick={() => navigate(`/live-tracking/${selected.tripId}`)}>
                  View Trip Details →
                </Button>
              </Card>
            ) : (
              <Card className="p-8 text-center text-sm text-slate-400">
                <MapPinIcon className="mx-auto mb-2 h-6 w-6" />
                Select a bus on the map to see details
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const LegendRow = ({ color, label }) => (
  <div className="mb-1 flex items-center gap-2 text-slate-500 dark:text-slate-400">
    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
    {label}
  </div>
);
