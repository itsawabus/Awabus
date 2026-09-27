import { useRef, useState } from 'react';
import { CheckCircle2, Search } from 'lucide-react';
import Input, { Label } from './Input.jsx';
import Button from './Button.jsx';
import { lookupGhanaPostGps } from '../../api/geocode.js';
import apiClient from '../../api/client.js';

export const GPS_ADDRESS_RE = /^[A-Z]{2}-[0-9]{3}-[0-9]{4}$/;

// Formats typed text as a GhanaPostGPS address: XX-XXX-XXXX
export function formatGpsAddress(raw) {
  let value = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 9);
  if (value.length > 2) value = value.slice(0, 2) + '-' + value.slice(2);
  if (value.length > 6) value = value.slice(0, 6) + '-' + value.slice(6);
  return value;
}

/**
 * GhanaPostGPS address field. Once a complete address is typed (or "Find" is
 * clicked) it is resolved to coordinates and passed to onResolve(location).
 */
export default function GpsAddressInput({ value, onChange, onResolve, disabled = false }) {
  const [status, setStatus] = useState({ state: 'idle' });
  const requestId = useRef(0);

  const lookup = async (address) => {
    const id = ++requestId.current;
    setStatus({ state: 'loading' });
    try {
      const location = await lookupGhanaPostGps(address);
      if (id !== requestId.current) return;
      setStatus({ state: 'found', location });
      onResolve(location);
    } catch (err) {
      if (id !== requestId.current) return;
      // "Not Found - /api/..." comes from Express when the route itself is missing,
      // i.e. the connected server hasn't been updated with the geocode endpoint.
      const message = /^Not Found - \//.test(err.message)
        ? `Address lookup isn't available on the connected server (${apiClient.defaults.baseURL}). Restart or redeploy the backend with the latest code.`
        : err.message;
      setStatus({ state: 'error', message });
    }
  };

  const complete = GPS_ADDRESS_RE.test(value || '');

  return (
    <div>
      <Label>GPS Address</Label>
      <div className="flex gap-2">
        <Input
          wrapperClassName="flex-1"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const next = formatGpsAddress(e.target.value);
            onChange(next);
            if (GPS_ADDRESS_RE.test(next) && next !== value) lookup(next);
            else if (!GPS_ADDRESS_RE.test(next)) {
              requestId.current++;
              setStatus({ state: 'idle' });
            }
          }}
          placeholder="GA-543-0125"
          maxLength={11}
          pattern="[A-Z]{2}-[0-9]{3}-[0-9]{4}"
          title="Enter a valid GhanaPostGPS address"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => lookup(value)}
          disabled={disabled || !complete}
          loading={status.state === 'loading'}
        >
          {status.state !== 'loading' && <Search className="h-4 w-4" />}
          Find
        </Button>
      </div>
      {status.state === 'idle' && !disabled && (
        <p className="mt-1 text-xs text-slate-500">Enter your GhanaPostGPS digital address</p>
      )}
      {status.state === 'loading' && <p className="mt-1 text-xs text-slate-500">Looking up address…</p>}
      {status.state === 'found' && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {[status.location.area, status.location.district, status.location.region].filter(Boolean).join(', ') ||
            'Location found'}
        </p>
      )}
      {status.state === 'error' && <p className="mt-1 text-xs font-medium text-red-500">{status.message}</p>}
    </div>
  );
}
