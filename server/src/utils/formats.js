// Server-side copies of the admin form format rules (admin/src/lib/formats.js),
// so a value can't skip a format by going around the form.

export const PLATE_RE = /^[A-Z]{1,3}-\d{1,4}-(\d{2}|[A-Z])$/;
export const LICENSE_RE = /^(?=.*\d)[A-Z0-9]+(-[A-Z0-9]+)*$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const GHANA = { minLat: 4.5, maxLat: 11.2, minLng: -3.3, maxLng: 1.3 };

// Upper-case and hyphenate, e.g. "gr 1234 20" -> "GR-1234-20".
export const normalizeCode = (v) =>
  String(v || '')
    .trim()
    .toUpperCase()
    .replace(/[\s_/]+/g, '-')
    .replace(/-{2,}/g, '-');

const blank = (v) => v === undefined || v === null || v === '';

const RULES = {
  plateNumber: (v) => (PLATE_RE.test(normalizeCode(v)) ? '' : 'Plate number must look like GR-1234-20'),
  licenseNumber: (v) => {
    const s = normalizeCode(v);
    return s.length >= 6 && s.length <= 20 && LICENSE_RE.test(s)
      ? ''
      : 'License number must be 6-20 capital letters and numbers, e.g. GH-DL-29831';
  },
  email: (v) => (EMAIL_RE.test(String(v).trim()) ? '' : 'Enter a valid email address'),
  capacity: (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 4 && n <= 100 ? '' : 'Capacity must be a whole number between 4 and 100';
  },
  geofenceRadius: (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 20 && n <= 1000 ? '' : 'Geofence radius must be between 20 and 1000 metres';
  },
  lat: (v) => {
    const n = Number(v);
    return !Number.isNaN(n) && n >= GHANA.minLat && n <= GHANA.maxLat ? '' : 'Latitude must be a location inside Ghana';
  },
  lng: (v) => {
    const n = Number(v);
    return !Number.isNaN(n) && n >= GHANA.minLng && n <= GHANA.maxLng ? '' : 'Longitude must be a location inside Ghana';
  },
  driverDob: (v) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return 'Enter a valid date of birth';
    const adult = new Date();
    adult.setFullYear(adult.getFullYear() - 18);
    return d <= adult ? '' : 'Drivers must be at least 18 years old';
  },
  studentDob: (v) => {
    const d = new Date(v);
    return !Number.isNaN(d.getTime()) && d < new Date() ? '' : 'Enter a valid date of birth';
  },
  licenseExpiry: (v) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return 'Enter a valid license expiry date';
    return d >= new Date(new Date().toDateString()) ? '' : 'This license has expired';
  },
};

const sameValue = (a, b) => {
  if (a instanceof Date || b instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(String(a))) {
    const da = new Date(a);
    const db = new Date(b);
    return !Number.isNaN(da.getTime()) && !Number.isNaN(db.getTime()) && da.toISOString().slice(0, 10) === db.toISOString().slice(0, 10);
  }
  if (typeof b === 'number' || typeof a === 'number') return Number(a) === Number(b);
  return normalizeCode(a) === normalizeCode(b);
};

/**
 * For edits: returns the new value only when it differs from what is stored.
 * Records saved before a format rule existed can then still be edited, while
 * anything newly typed must follow the rule.
 */
export const ifChanged = (next, current) =>
  next === undefined || next === null || next === '' || (current != null && current !== '' && sameValue(next, current))
    ? undefined
    : next;

/** The problem with one value ('' when fine or blank). */
export const formatProblem = (rule, value) => (blank(value) ? '' : RULES[rule](value));

/**
 * Checks { rule: value } pairs, skipping blank values (required-ness is checked
 * separately). Throws a 400 with the first problem found.
 */
export function assertFormats(res, pairs) {
  for (const [rule, value] of Object.entries(pairs)) {
    if (blank(value)) continue;
    const problem = RULES[rule](value);
    if (problem) {
      res.status(400);
      throw new Error(problem);
    }
  }
}
