// Resolves GhanaPostGPS digital addresses (e.g. GA-543-0125) to coordinates using
// the public GhanaPostGPS REST API: https://github.com/jayluxferro/GhanaPostGPS-REST-API
// Point GHANAPOSTGPS_API_URL at a self-hosted instance (docker image
// jayluxferro/ghanapostgps-api) if the public one is slow or unavailable.

const DEFAULT_API_URL = 'https://ghanapostgps.sperixlabs.org';
const TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 1000;

// 2 region letters, 3-4 digit area code, 4 digit unique code. Dashes/spaces optional.
const ADDRESS_RE = /^([A-Z]{2})-?(\d{3,4})-?(\d{4})$/;

const cache = new Map();

export class GpsLookupError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** Normalizes user input to the canonical XX-XXX-XXXX form, or returns null if invalid. */
export function normalizeGpsAddress(input) {
  const compact = String(input || '')
    .toUpperCase()
    .replace(/[\s-]/g, '');
  const match = compact.match(/^([A-Z]{2})(\d{3,4})(\d{4})$/);
  if (!match) return null;
  const normalized = `${match[1]}-${match[2]}-${match[3]}`;
  return ADDRESS_RE.test(normalized) ? normalized : null;
}

export async function lookupGpsAddress(input) {
  const address = normalizeGpsAddress(input);
  if (!address) {
    throw new GpsLookupError('Enter a valid GhanaPostGPS address, e.g. GA-543-0125', 400);
  }

  const cached = cache.get(address);
  if (cached && cached.expires > Date.now()) return cached.value;

  const baseUrl = (process.env.GHANAPOSTGPS_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
  let body;
  try {
    const res = await fetch(`${baseUrl}/get-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ address }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    body = await res.json();
  } catch (err) {
    console.error(`GhanaPostGPS lookup failed for ${address}:`, err.message);
    throw new GpsLookupError('GhanaPostGPS service is unavailable. Try again or enter coordinates manually.', 502);
  }

  const row = body?.found ? body?.data?.Table?.[0] : null;
  const lat = Number(row?.CenterLatitude);
  const lng = Number(row?.CenterLongitude);
  if (!row || Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new GpsLookupError(`No location found for ${address}`, 404);
  }

  const value = {
    address,
    lat,
    lng,
    area: row.Area || '',
    district: row.District || '',
    region: row.Region || '',
    street: row.Street || '',
    postCode: row.PostCode || '',
  };

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(address, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}
