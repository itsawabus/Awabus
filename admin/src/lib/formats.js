// Format rules for inputs that have a fixed shape. Each "format*" helper cleans
// what the user types (so wrong characters never appear), and each "*Error"
// helper returns a message when the value is still not acceptable, or '' when
// it is. The server applies the same rules (server/src/utils/formats.js).

// Vehicle plate, Ghana DVLA style: region letters - number - year or series
// letter, e.g. GR-1234-20, GC-102-21, GT-881-Z.
export const PLATE_RE = /^[A-Z]{1,3}-\d{1,4}-(\d{2}|[A-Z])$/;
export const PLATE_MAX_LENGTH = 11; // ABC-1234-20

// Typed as a mask, like the GPS address: the dashes are put in for you and
// nothing that can't belong in a plate gets in.
//   gr123420 -> GR-1234-20   gt 881 z -> GT-881-Z   gc102-21 -> GC-102-21
// Region: 1-3 letters. Number: 1-4 digits (a 4th digit, a letter, a space or
// a dash moves on). End: a 2-digit year or one series letter.
export function formatPlate(raw) {
  const chars = String(raw || '').toUpperCase().replace(/[\s_/.]/g, '-').replace(/[^A-Z0-9-]/g, '');
  let region = '';
  let number = '';
  let end = '';
  let part = 0;
  for (const c of chars) {
    const isLetter = /[A-Z]/.test(c);
    const isDigit = /\d/.test(c);
    if (part === 0) {
      if (isLetter && region.length < 3) region += c;
      else if (region && (isDigit || c === '-')) {
        part = 1;
        if (isDigit) number += c;
      }
    } else if (part === 1) {
      if (isDigit && number.length < 4) number += c;
      else if (number && (isLetter || isDigit || c === '-')) {
        part = 2;
        if (isLetter || isDigit) end += c;
      }
    } else if (end === '' ? isLetter || isDigit : /\d/.test(end) && isDigit && end.length < 2) {
      end += c;
    }
  }
  if (part === 0) return region;
  if (part === 1) return `${region}-${number}`;
  return `${region}-${number}-${end}`;
}
export const plateError = (v) =>
  !v ? 'Plate number is required' : PLATE_RE.test(v) ? '' : 'Complete the plate, e.g. GR-1234-20 or GT-881-Z';

// Driver's license number: capital letters and digits in groups separated by
// hyphens (e.g. GH-DL-29831), 6 to 20 characters, with at least one digit.
export const LICENSE_RE = /^(?=.*\d)[A-Z0-9]+(-[A-Z0-9]+)*$/;
export const LICENSE_MAX_LENGTH = 20;

// Typed as a mask: capitals only, a dash is put in where letters change to
// digits (GHDL29831 -> GHDL-29831), spaces and slashes become dashes, and a
// group can't start with a dash or have two in a row.
export function formatLicense(raw) {
  let out = '';
  for (const c of String(raw || '').toUpperCase().replace(/[\s_/.]/g, '-').replace(/[^A-Z0-9-]/g, '')) {
    const prev = out.slice(-1);
    if (c === '-') {
      if (out && prev !== '-') out += '-';
      continue;
    }
    if (/\d/.test(c) && /[A-Z]/.test(prev)) out += '-';
    out += c;
  }
  return out.slice(0, LICENSE_MAX_LENGTH);
}
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
// Capacity is optional: blank is fine.
export const capacityError = (v) => {
  const n = Number(v);
  if (v === '' || v == null) return '';
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
