import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { ArrowDown, ArrowUp, MapPin, Trash2 } from 'lucide-react';
import { ACCRA_DEFAULT, MapLayers, round6 } from '../map/GeofenceMap.jsx';
import GpsAddressInput from '../ui/GpsAddressInput.jsx';
import Input, { FieldError } from '../ui/Input.jsx';
import Button from '../ui/Button.jsx';
import { formatLat, formatLng } from '../../lib/gps.js';

export const MAX_STOPS = 50;
// Roughly Ghana, with a margin: stops outside this are almost certainly a typo.
const inGhana = (lat, lng) => lat >= 4.3 && lat <= 11.5 && lng >= -3.6 && lng <= 1.5;

/** Problems with a stop list, keyed by index, plus an overall message. */
export function stopsErrors(stops = []) {
  const byIndex = {};
  stops.forEach((s, i) => {
    const name = String(s.name || '').trim();
    if (name.length < 2 || name.length > 80) byIndex[i] = 'Give this stop a name (2-80 characters)';
    else if (!Number.isFinite(Number(s.lat)) || !Number.isFinite(Number(s.lng))) byIndex[i] = 'Place this stop on the map';
    else if (!inGhana(Number(s.lat), Number(s.lng))) byIndex[i] = 'This stop is outside Ghana. Check its position';
  });
  const overall = stops.length > MAX_STOPS ? `A route can have at most ${MAX_STOPS} stops` : '';
  return { byIndex, overall, any: Boolean(overall || Object.keys(byIndex).length) };
}

const numberIcon = (n, active) =>
  L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:${active ? '#0f172a' : '#0d9488'};color:white;font:700 12px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

function ClickToAdd({ onAdd }) {
  useMapEvents({ click: (e) => onAdd(round6(e.latlng.lat), round6(e.latlng.lng)) });
  return null;
}

// Fit the map to the stops the route already had when the page opened. It must
// not move while stops are being added, or the next click would land on a pin.
function FitInitial({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(points, { padding: [30, 30] });
  }, [points, map]);
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 15));
  }, [target, map]);
  return null;
}

/**
 * Stops along a route, in order. Click the map to add a stop, drag a pin to
 * move it, or find one by GhanaPost address. stops: [{ name, lat, lng }].
 */
export default function RouteStopsEditor({ stops = [], onChange, showErrors }) {
  const [gps, setGps] = useState('');
  const [active, setActive] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [initialPoints] = useState(() =>
    stops.filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng))).map((s) => [Number(s.lat), Number(s.lng)])
  );
  const errors = showErrors ? stopsErrors(stops) : { byIndex: {}, overall: '' };
  const points = useMemo(
    () => stops.filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng))).map((s) => [Number(s.lat), Number(s.lng)]),
    [stops]
  );

  const update = (i, patch) => onChange(stops.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const add = (lat, lng, name) => {
    if (stops.length >= MAX_STOPS) return;
    onChange([...stops, { name: name || `Stop ${stops.length + 1}`, lat, lng }]);
    setActive(stops.length);
  };
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= stops.length) return;
    const next = [...stops];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setActive(j);
  };
  const remove = (i) => {
    onChange(stops.filter((_, j) => j !== i));
    setActive(null);
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <div className="h-[360px] overflow-hidden rounded-xl border border-slate-200 sm:h-[420px] dark:border-slate-700">
          <MapContainer center={[ACCRA_DEFAULT.lat, ACCRA_DEFAULT.lng]} zoom={12} scrollWheelZoom className="h-full w-full">
            <MapLayers />
            <ClickToAdd onAdd={(la, ln) => add(la, ln)} />
            <FitInitial points={initialPoints} />
            <FlyTo target={flyTarget} />
            {points.length > 1 && <Polyline positions={points} pathOptions={{ color: '#0d9488', weight: 4, opacity: 0.7 }} />}
            {stops.map((s, i) =>
              Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)) ? (
                <Marker
                  key={`${i}-${s.lat}-${s.lng}`}
                  position={[Number(s.lat), Number(s.lng)]}
                  icon={numberIcon(i + 1, active === i)}
                  draggable
                  eventHandlers={{
                    click: () => setActive(i),
                    dragend: (e) => {
                      const { lat, lng } = e.target.getLatLng();
                      update(i, { lat: round6(lat), lng: round6(lng) });
                      setActive(i);
                    },
                  }}
                />
              ) : null
            )}
          </MapContainer>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Click the map to add the next stop. Drag a numbered pin to move it. Stops are driven in the order listed.
        </p>
      </div>

      <div className="space-y-4">
        <GpsAddressInput
          value={gps}
          onChange={setGps}
          onResolve={({ lat, lng }) => {
            add(round6(lat), round6(lng), `Stop ${stops.length + 1} (${gps})`);
            setFlyTarget([lat, lng]);
            setGps('');
          }}
        />
        <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">A found address is added as the next stop.</p>

        {stops.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <MapPin className="mx-auto mb-2 h-5 w-5 text-slate-400" />
            No stops yet. Click the map or find a GhanaPost address to add the first one.
          </div>
        ) : (
          <ol className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {stops.map((s, i) => (
              <li
                key={i}
                className={`rounded-xl border p-3 ${active === i ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-500/5' : 'border-slate-200 dark:border-slate-700'}`}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActive(i);
                      if (Number.isFinite(Number(s.lat))) setFlyTarget([Number(s.lat), Number(s.lng)]);
                    }}
                    className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white"
                    aria-label={`Show stop ${i + 1} on the map`}
                  >
                    {i + 1}
                  </button>
                  <div className="min-w-0 flex-1">
                    <Input
                      value={s.name}
                      onChange={(e) => update(i, { name: e.target.value })}
                      onFocus={() => setActive(i)}
                      placeholder="Stop name, e.g. Starbites junction"
                      maxLength={80}
                      aria-label={`Name of stop ${i + 1}`}
                      error={Boolean(errors.byIndex[i])}
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      {formatLat(s.lat)}, {formatLng(s.lng)}
                    </p>
                    <FieldError>{errors.byIndex[i]}</FieldError>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0} icon={ArrowUp} />
                    <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === stops.length - 1} icon={ArrowDown} />
                    <IconBtn label="Remove stop" onClick={() => remove(i)} icon={Trash2} danger />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
        {errors.overall && <p className="text-sm font-medium text-red-600">{errors.overall}</p>}
        {stops.length > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {stops.length} stop{stops.length === 1 ? '' : 's'}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...stops].reverse())}>
              Reverse order
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

const IconBtn = ({ label, onClick, disabled, icon: Icon, danger }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-navy ${danger ? 'hover:text-red-600' : ''}`}
  >
    <Icon className="h-3.5 w-3.5" />
  </button>
);
