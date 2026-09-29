import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import { Crosshair, LocateFixed, MapPin } from 'lucide-react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import GeofenceMap, { ACCRA_DEFAULT, round6, toPoint } from '../map/GeofenceMap.jsx';

// Exposes the Leaflet map instance to the parent so toolbar buttons can fly around.
function MapHandle({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
    // The modal renders into a portal, so make sure tiles fill the final container size.
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [map, onReady]);
  return null;
}

/**
 * Pop-up map for choosing a coordinate. Click the map or drag the pin to move it,
 * use the zoom controls / scroll wheel to zoom, then "Use this location" to apply.
 */
export default function LocationPickerModal({ open, onClose, lat, lng, radius, onConfirm, title = 'Pick location on map' }) {
  const [point, setPoint] = useState(toPoint(lat, lng) ?? ACCRA_DEFAULT);
  const [map, setMap] = useState(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  // Reset to the current field values every time the modal opens.
  useEffect(() => {
    if (open) {
      setPoint(toPoint(lat, lng) ?? ACCRA_DEFAULT);
      setGeoError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const zoomToPin = () => map?.flyTo([point.lat, point.lng], 18);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by this browser.');
      return;
    }
    setLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: round6(pos.coords.latitude), lng: round6(pos.coords.longitude) };
        setPoint(next);
        map?.flyTo([next.lat, next.lng], 17);
        setLocating(false);
      },
      () => {
        setGeoError('Could not get your current location.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirm(point.lat, point.lng);
              onClose();
            }}
          >
            <MapPin className="h-4 w-4" />
            Use this location
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Click the map or drag the pin. Scroll or use +/− to zoom.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={zoomToPin}>
            <Crosshair className="h-4 w-4" />
            Zoom to pin
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={useMyLocation} loading={locating}>
            {!locating && <LocateFixed className="h-4 w-4" />}
            My location
          </Button>
        </div>
      </div>

      <div className="h-[60vh] max-h-[520px] min-h-[300px]">
        <GeofenceMap
          lat={point.lat}
          lng={point.lng}
          radius={radius}
          zoom={toPoint(lat, lng) ? 16 : 13}
          onMove={(la, ln) => setPoint({ lat: la, lng: ln })}
        >
          <MapHandle onReady={setMap} />
        </GeofenceMap>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-slate-500 dark:text-slate-400">
          Latitude: <span className="font-semibold text-slate-800 dark:text-slate-100">{point.lat}</span>
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          Longitude: <span className="font-semibold text-slate-800 dark:text-slate-100">{point.lng}</span>
        </span>
        {Number(radius) > 0 && (
          <span className="text-slate-500 dark:text-slate-400">
            Geofence: <span className="font-semibold text-green-600">{radius}m</span>
          </span>
        )}
      </div>
      {geoError && <p className="mt-2 text-sm text-red-600">{geoError}</p>}
    </Modal>
  );
}
