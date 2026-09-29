import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleMarker, MapContainer, Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapLayers } from '../../components/map/GeofenceMap.jsx';
import { AlertTriangle, CheckCircle2, Clock, Navigation2, MapPin as MapPinIcon, SignalZero } from 'lucide-react';
import usePageHeader from '../../hooks/usePageHeader.js';
import { useSocketEvent } from '../../hooks/useSocket.js';
import { getTrackingOverview, getTrackingTrail } from '../../api/tracking.js';
import Card from '../../components/ui/Card.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { PillTabs } from '../../components/ui/Tabs.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { PageLoader } from '../../components/ui/Spinner.jsx';
import { gpsFreshness } from '../../lib/gps.js';
import useNow from '../../hooks/useNow.js';
import { formatPhone } from '../../lib/phone.js';
import { sessionLabel, statusLabel } from '../../lib/sessions.js';
import { ConnectionPair } from '../../components/buses/BusOnlineStatus.jsx';

const busIcon = (color) =>
  L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;border-radius:9999px;background:${color};display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M4 17V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9a1.5 1.5 0 0 1-1.5 1.5H18a2 2 0 0 1-4 0H10a2 2 0 0 1-4 0H5.5A1.5 1.5 0 0 1 4 17Z"/></svg></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

// Marker colour: how fresh the position is first, then whether the trip is delayed.
const MARKER = { live: '#0d9488', delayed: '#f59e0b', stale: '#64748b', lost: '#94a3b8' };
const markerColor = (b) => {
  if (b.gps.state === 'lost' || b.gps.state === 'none') return MARKER.lost;
  if (b.gps.state === 'stale') return MARKER.stale;
  return b.status === 'Delayed' ? MARKER.delayed : MARKER.live;
};
const isOffline = (b) => b.gps.state !== 'live';

// Trips without a GPS fix yet have an empty liveLocation ({}), so only treat a
// location as usable when both coordinates are real numbers.
const toLatLng = (loc) =>
  loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng) ? [loc.lat, loc.lng] : null;

// While following, keep the selected bus in the middle of the map as it moves.
function FollowBus({ position, follow }) {
  const map = useMap();
  useEffect(() => {
    if (follow && position) map.setView(position, map.getZoom(), { animate: true });
  }, [position, follow, map]);
  return null;
}

// The trail: where the selected bus has been (dots) and where each child was
// picked up or dropped, with the time.
const TRAIL_COLOR = '#0d9488';
const EVENT_COLOR = { 'Dropped off': '#059669', 'On board': '#2563eb', 'Not on board': '#dc2626' };
const MAX_DOTS = 600;
const timeOf = (at) => (at ? new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');
function BusTrail({ trail, session }) {
  const points = (trail?.path || []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!points.length && !trail?.events?.length) return null;
  const line = points.map((p) => [p.lat, p.lng]);
  // Long trips: every nth dot, so the map stays quick (the line still shows it all).
  const step = Math.max(1, Math.ceil(points.length / MAX_DOTS));
  const dots = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  return (
    <>
      {line.length > 1 && <Polyline positions={line} pathOptions={{ color: TRAIL_COLOR, weight: 3, opacity: 0.45 }} />}
      {dots.map((p, i) => (
        <CircleMarker
          key={`d${i}`}
          center={[p.lat, p.lng]}
          radius={3}
          pathOptions={{ color: TRAIL_COLOR, weight: 1, fillColor: TRAIL_COLOR, fillOpacity: 0.8 }}
        >
          <Tooltip direction="top">Bus passed here at {timeOf(p.at)}</Tooltip>
        </CircleMarker>
      ))}
      {(trail?.events || []).map((e) => (
        <CircleMarker
          key={`e${e.studentId}`}
          center={[e.lat, e.lng]}
          radius={8}
          pathOptions={{ color: 'white', weight: 2, fillColor: EVENT_COLOR[e.status] || TRAIL_COLOR, fillOpacity: 1 }}
        >
          <Tooltip direction="top">
            <strong>{e.name}</strong>
            <br />
            {statusLabel(session, e.status)} at {timeOf(e.at)}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

// Dragging the map means the admin wants to look around: stop following.
function StopFollowOnDrag({ onDrag }) {
  useMapEvents({ dragstart: onDrag });
  return null;
}

export default function LiveTracking() {
  usePageHeader({ breadcrumb: ['AwaBus', 'Live Tracking'] });
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [liveBuses, setLiveBuses] = useState([]);
  const [follow, setFollow] = useState(true);
  const queryClient = useQueryClient();

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

  // Trail of the selected bus: loaded once, then grown live from positions.
  const { data: trail } = useQuery({
    queryKey: ['tracking-trail', selectedTripId],
    queryFn: () => getTrackingTrail(selectedTripId),
    enabled: Boolean(selectedTripId),
    refetchInterval: 60000,
  });
  useSocketEvent('trip:studentUpdate', ({ tripId }) => {
    if (tripId === selectedTripId) queryClient.invalidateQueries({ queryKey: ['tracking-trail', tripId] });
  });

  useSocketEvent('bus:location', ({ tripId, location, source }) => {
    if (tripId === selectedTripId && Number.isFinite(location?.lat)) {
      queryClient.setQueryData(['tracking-trail', tripId], (old) =>
        old ? { ...old, path: [...(old.path || []), { lat: location.lat, lng: location.lng, at: location.updatedAt }] } : old
      );
    }
    setLiveBuses((prev) =>
      prev.map((b) => (b.tripId === tripId ? { ...b, liveLocation: location, gpsSignal: 'ok', busOnline: true, locationSource: source || b.locationSource } : b))
    );
  });
  // A trip starting or ending changes which buses are on the map: reload now
  // instead of waiting for the next 15-second refresh.
  const reload = () => queryClient.invalidateQueries({ queryKey: ['tracking-overview'] });
  useSocketEvent('trip:started', reload);
  useSocketEvent('trip:assistLocation', reload);
  useSocketEvent('trip:ended', reload);

  // Every bus gets its GPS freshness, re-worked out as time passes (useNow).
  const now = useNow(15000);
  const buses = useMemo(() => liveBuses.map((b) => ({ ...b, gps: gpsFreshness(b.liveLocation, now) })), [liveBuses, now]);

  const filtered = useMemo(() => {
    if (filter === 'active') return buses.filter((b) => b.status !== 'Delayed' && !isOffline(b));
    if (filter === 'delayed') return buses.filter((b) => b.status === 'Delayed');
    if (filter === 'offline') return buses.filter(isOffline);
    return buses;
  }, [buses, filter]);

  const counts = {
    all: buses.length,
    active: buses.filter((b) => b.status !== 'Delayed' && !isOffline(b)).length,
    delayed: buses.filter((b) => b.status === 'Delayed').length,
    offline: buses.filter(isOffline).length,
  };
  const selected = buses.find((b) => b.tripId === selectedTripId);
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
          <Badge tone={buses.length ? 'success' : 'neutral'}>
            {buses.length} {buses.length === 1 ? 'trip' : 'trips'} running{counts.offline ? ` · ${counts.offline} not reporting` : ''}
          </Badge>
        </div>
        <p className="text-sm text-slate-400">Monitoring: positions refresh every 15s</p>
      </div>

      <PillTabs
        className="mb-5"
        tabs={[
          { value: 'all', label: `All buses (${counts.all})` },
          { value: 'active', label: `Active (${counts.active})` },
          { value: 'delayed', label: `Delayed (${counts.delayed})` },
          { value: 'offline', label: `Not reporting (${counts.offline})` },
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
              <button
                type="button"
                onClick={() => setFollow((f) => !f)}
                aria-pressed={follow}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow ${
                  follow ? 'bg-slate-700 text-white' : 'bg-white text-slate-700 dark:bg-navy-light dark:text-slate-200'
                }`}
                title={follow ? 'The map keeps the selected bus in the middle. Click to stop.' : 'Keep the selected bus in the middle of the map'}
              >
                <Navigation2 className="h-3.5 w-3.5" /> {follow ? 'Following bus' : 'Follow bus'}
              </button>
            </div>
            <div className="h-[520px] w-full">
              <MapContainer center={center} zoom={13} className="h-full w-full" zoomControl={false}>
                {/* Street / Satellite / Hybrid / Terrain switcher, top right */}
                <MapLayers />
                <FollowBus position={selectedPos} follow={follow} />
                <StopFollowOnDrag onDrag={() => setFollow(false)} />
                {selected && <BusTrail trail={trail} session={selected.session} />}
                {filtered.map((b) => {
                  const pos = toLatLng(b.liveLocation);
                  if (!pos) return null;
                  const routePath = (b.route?.stops || []).filter((s) => s.lat && s.lng).map((s) => [s.lat, s.lng]);
                  return (
                    <div key={b.tripId}>
                      {routePath.length > 1 && <Polyline positions={routePath} color="#cbd5e1" weight={3} />}
                      <Marker
                        position={pos}
                        icon={busIcon(markerColor(b))}
                        opacity={b.gps.state === 'live' ? 1 : 0.75}
                        eventHandlers={{ click: () => { setSelectedTripId(b.tripId); setFollow(true); } }}
                      />
                    </div>
                  );
                })}
              </MapContainer>
            </div>
            <div className="absolute bottom-4 left-4 z-[400] rounded-xl bg-white p-3 text-xs shadow dark:bg-navy-light">
              <p className="mb-2 font-bold text-slate-600 dark:text-slate-200">MAP LEGEND</p>
              <LegendRow color={MARKER.live} label="Live position" />
              <LegendRow color={MARKER.delayed} label="Live, trip delayed" />
              <LegendRow color={MARKER.stale} label="Last seen 2-10 min ago" />
              <LegendRow color={MARKER.lost} label="No GPS for 10+ min" />
              <LegendRow color={TRAIL_COLOR} label="Trail: where the bus passed" />
              <LegendRow color={EVENT_COLOR['Dropped off']} label="Child dropped here (tap for time)" />
              <LegendRow color={EVENT_COLOR['On board']} label="Child picked up here" />
            </div>
          </Card>

          <div>
            {selected ? (
              <Card className="p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Selected Bus</p>
                <div className="mt-1 flex items-center justify-between">
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">{selected.bus?.name}</h3>
                  <Badge tone={selected.status === 'Delayed' ? 'warning' : 'success'}>{selected.status}</Badge>
                </div>
                <p className="text-sm text-slate-400">
                  Plate: {selected.bus?.plateNumber} · {selected.bus?.capacity} Seater
                </p>

                <div className="my-4 h-px bg-slate-100 dark:bg-slate-800" />
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  {selected.driver ? `${selected.driver.firstName} ${selected.driver.lastName}` : '—'}
                </p>
                <p className="text-sm text-slate-400">Driver · {formatPhone(selected.driver?.phone)}</p>
                <AssistantLocationLine info={selected.assistantLocation} />
                {(selected.assistants || []).map((a) => (
                  <p key={a.name} className="mt-1 flex items-center gap-1.5 text-sm">
                    <span className={`h-2 w-2 rounded-full ${a.connected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    <span className={a.connected ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}>
                      Bus assistant {a.name} · {a.connected ? 'connected' : 'disconnected'}
                    </span>
                  </p>
                ))}

                <div className="my-4 h-px bg-slate-100 dark:bg-slate-800" />
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Route Details</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="font-bold text-slate-800 dark:text-slate-100">{selected.route?.name}</p>
                  <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">{selected.etaMinutes || 0}m running</span>
                </div>
                <p className="text-sm text-slate-400">
                  {selected.session ? `${sessionLabel(selected.session)} · ` : ''}Departure: {selected.departureTime || '—'}
                </p>

                <div className="my-4 h-px bg-slate-100 dark:bg-slate-800" />
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Online</p>
                <ConnectionPair className="mt-1" busOnline={selected.busOnline} driverOnline={selected.driverOnline} hasDriver={Boolean(selected.driver)} />

                <div className="my-4 h-px bg-slate-100 dark:bg-slate-800" />
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">GPS Signal</p>
                <GpsState gps={selected.gps} />
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selected.gps.detail}</p>
                <LocationSource source={selected.locationSource} assistantName={selected.assistantName} />

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

const ASSIST_LOCATION = {
  standby: { dot: 'bg-emerald-500', text: 'on, standing by (the driver\'s phone is reporting)' },
  covering: { dot: 'bg-amber-500', text: 'on, showing the bus now (the driver\'s phone is not reporting)' },
  not_on_bus: { dot: 'bg-red-500', text: 'on, but their phone is not near the bus, so it is not used' },
  off: { dot: 'bg-slate-400', text: 'off' },
};

/** The bus assistant's "Share my location as backup" switch. */
export function AssistantLocationLine({ info }) {
  if (!info || info.state === 'none') return null;
  const look = ASSIST_LOCATION[info.state] || ASSIST_LOCATION.off;
  const when = info.state === 'off' && info.at ? ` since ${new Date(info.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : '';
  return (
    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
      <span className={`h-2 w-2 shrink-0 rounded-full ${look.dot}`} />
      <span>
        Assistant{info.name ? ` ${info.name}` : ''}&apos;s backup location: {look.text}
        {when}
        {info.quiet && info.state === 'off' ? ' (their page stopped sending)' : ''}
      </span>
    </p>
  );
}

/** Whose phone the bus position comes from, when it isn't the driver's. */
export function LocationSource({ source, assistantName }) {
  if (source !== 'assistant') return null;
  return (
    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
      Location from the bus assistant{assistantName ? ` (${assistantName})` : ''}: the driver&apos;s phone is not reporting.
    </p>
  );
}

/** GPS freshness as icon + words (never colour alone). */
export function GpsState({ gps }) {
  const look = {
    live: { Icon: CheckCircle2, cls: 'text-emerald-700 dark:text-emerald-400' },
    stale: { Icon: Clock, cls: 'text-amber-700 dark:text-amber-400' },
    lost: { Icon: SignalZero, cls: 'text-red-600 dark:text-red-400' },
    none: { Icon: AlertTriangle, cls: 'text-slate-500' },
  }[gps.state];
  return (
    <p className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${look.cls}`}>
      <look.Icon className="h-4 w-4 shrink-0" /> {gps.label}
    </p>
  );
}

const LegendRow = ({ color, label }) => (
  <div className="mb-1 flex items-center gap-2 text-slate-500 dark:text-slate-400">
    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
    {label}
  </div>
);
