// Format rules for inputs that have a fixed shape. Each "format*" helper cleans
// what the user types (so wrong characters never appear), and each "*Error"
// helper returns a message when the value is still not acceptable, or '' when
// it is. The server applies the same rules (server/src/utils/formats.js).

// Vehicle plate, Ghana DVLA style: region letters - number - year or series
// letter, e.g. GR-1234-20, GC-102-21, GT-881-Z.
export const PLATE_RE = /^[A-Z]{1,3}-\d{1,4}-(\d{2}|[A-Z])$/;
export const formatPlate = (raw) =>
  String(raw || '')
    .toUpperCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 12);
export const plateError = (v) =>
  !v ? 'Plate number is required' : PLATE_RE.test(v) ? '' : 'Use the plate format e.g. GR-1234-20';

// Driver's license number: capital letters and digits, optionally in groups
// separated by hyphens (e.g. GH-DL-29831), 6 to 20 characters.
export const LICENSE_RE = /^(?=.*\d)[A-Z0-9]+(-[A-Z0-9]+)*$/;
export const formatLicense = (raw) =>
  String(raw || '')
    .toUpperCase()
    .replace(/[\s_/]+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 20);
export const licenseError = (v) => {
  if (!v) return 'License number is required';
  if (v.length < 6 || !LICENSE_RE.test(v)) return 'Use capital letters and numbers only, e.g. GH-DL-29831';
  return '';
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
export const formatEmail = (raw) => String(raw || '').replace(/\s/g, '').toLowerCase();
export const emailError = (v, { required = false } = {}) => {
  if (!v) return required ? 'Email is required' : '';
  return EMAIL_RE.test(v) ? '' : 'Enter a valid email, e.g. name@gmail.com';
};

// Person names: letters (including accented), spaces, hyphens, apostrophes and dots.
export const formatName = (raw) =>
  String(raw || '')
    .replace(/[^\p{L}\s'.-]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 50);
export const nameError = (v, label = 'Name', { required = true } = {}) => {
  if (!v?.trim()) return required ? `${label} is required` : '';
  return v.trim().length < 2 ? `${label} is too short` : '';
};

// Whole numbers only, e.g. capacity or geofence radius.
export const digitsOnly = (raw, maxLength = 4) => String(raw ?? '').replace(/\D/g, '').slice(0, maxLength);

export const CAPACITY_MIN = 4;
export const CAPACITY_MAX = 100;
export const capacityError = (v) => {
  const n = Number(v);
  if (v === '' || v == null) return 'Capacity is required';
  return Number.isInteger(n) && n >= CAPACITY_MIN && n <= CAPACITY_MAX
    ? ''
    : `Capacity must be between ${CAPACITY_MIN} and ${CAPACITY_MAX} seats`;
};

export const RADIUS_MIN = 20;
export const RADIUS_MAX = 1000;
export const radiusError = (v) => {
  const n = Number(v);
  if (v === '' || v == null) return '';
  return Number.isInteger(n) && n >= RADIUS_MIN && n <= RADIUS_MAX
    ? ''
    : `Geofence radius must be between ${RADIUS_MIN} and ${RADIUS_MAX} metres`;
};

// Map coordinates: a signed decimal number; must fall inside Ghana.
export const formatCoord = (raw) => {
  let s = String(raw ?? '').replace(/[^\d.-]/g, '');
  s = s.replace(/(?!^)-/g, ''); // minus sign only at the start
  const [whole, ...rest] = s.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 6)}` : whole;
};
export const GHANA_BOUNDS = { minLat: 4.5, maxLat: 11.2, minLng: -3.3, maxLng: 1.3 };
export const coordsError = (lat, lng) => {
  if ((lat === '' || lat == null) && (lng === '' || lng == null)) return '';
  const la = Number(lat);
  const ln = Number(lng);
  if (lat === '' || lng === '' || Number.isNaN(la) || Number.isNaN(ln)) return 'Enter both latitude and longitude as numbers';
  const b = GHANA_BOUNDS;
  if (la < b.minLat || la > b.maxLat || ln < b.minLng || ln > b.maxLng) {
    return 'That location is outside Ghana. Check the latitude (about 4.5 to 11.2) and longitude (about -3.3 to 1.3).';
  }
  return '';
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const yearsAgoIso = (years) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
};

// Date limits, used both as the date picker's min/max and for checking.
export const DATE_LIMITS = {
  driverDob: { min: yearsAgoIso(80), max: yearsAgoIso(18) },
  studentDob: { min: yearsAgoIso(25), max: yearsAgoIso(1) },
  licenseExpiry: { min: todayIso(), max: yearsAgoIso(-15) },
};
export const dateError = (v, kind) => {
  if (!v) return '';
  const { min, max } = DATE_LIMITS[kind];
  if (kind === 'driverDob' && v > max) return 'Drivers must be at least 18 years old';
  if (kind === 'licenseExpiry' && v < min) return 'This license has expired. Enter a license that is still valid.';
  if (v < min || v > max) return 'Enter a realistic date';
  return '';
};

/**
 * For edit forms: only check a value that was changed. Records saved before a
 * rule existed can still be edited; anything newly typed must follow the rule.
 */
export const ifChanged = (value, original, check) =>
  String(value ?? '').trim() === String(original ?? '').trim() ? '' : check();
