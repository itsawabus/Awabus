import ExcelJS from 'exceljs';
import Route from '../models/Route.js';
import Bus from '../models/Bus.js';
import Driver from '../models/Driver.js';
import Student from '../models/Student.js';
import Guardian from '../models/Guardian.js';
import { ghanaPhoneVariants, isValidGhanaPhone, normalizeGhanaPhone } from '../utils/phone.js';
import { EMAIL_RE, formatProblem, normalizeCode, normalizeLicense, normalizePlate } from '../utils/formats.js';
import { MAX_ROWS, SPECS } from './specs.js';
import { normalizeLanguage } from '../utils/languages.js';
import { parseTime } from '../utils/sessions.js';

const DATA_ROWS = MAX_ROWS; // rows 2..MAX_ROWS+1 carry the Excel rules
const BRAND = 'FF0D9488';
const REQUIRED_FILL = 'FFFDE68A';
const OPTIONAL_FILL = 'FFE2E8F0';
const MISSING_FILL = 'FFFECACA';
const GPS_RE = /^[A-Z]{2}-\d{3}-\d{4}$/;
const NAME_RE = /^[\p{L}][\p{L}\s'.-]*$/u;

const colLetter = (n) => {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};
const headerText = (c) => (c.required ? `${c.header} *` : c.header);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------------------------------------------------------------------------
// Existing records the dropdowns (and the checks) refer to
// ---------------------------------------------------------------------------

const routeLabel = (r) => `${r.routeId} - ${r.name}`;
const busLabel = (b) => `${b.plateNumber} - ${b.name}`;

async function loadRefs(names) {
  const refs = {};
  if (names.has('allRoutes') || names.has('routesWithoutBus')) {
    const routes = await Route.find().select('routeId name assignedBus').sort({ routeId: 1 }).lean();
    refs.allRoutes = routes.map((r) => ({ id: r._id, code: r.routeId, name: r.name, label: routeLabel(r), taken: false }));
    refs.routesWithoutBus = routes.map((r) => ({
      id: r._id,
      code: r.routeId,
      name: r.name,
      label: routeLabel(r),
      taken: Boolean(r.assignedBus),
      takenMessage: 'already has a bus. A route can only have one bus',
    }));
  }
  if (names.has('busesWithoutDriver')) {
    const [buses, held] = await Promise.all([
      Bus.find().select('plateNumber name assignedRoute').sort({ plateNumber: 1 }).lean(),
      Driver.find({ assignedBus: { $ne: null } }).select('assignedBus firstName lastName').lean(),
    ]);
    const holder = new Map(held.map((d) => [String(d.assignedBus), `${d.firstName} ${d.lastName}`]));
    refs.busesWithoutDriver = buses.map((b) => ({
      id: b._id,
      code: b.plateNumber,
      label: busLabel(b),
      taken: holder.has(String(b._id)) || !b.assignedRoute,
      takenMessage: holder.has(String(b._id))
        ? `already has a driver (${holder.get(String(b._id))}). A bus can only have one driver`
        : 'is not on a route yet. Give it a route first',
    }));
  }
  return refs;
}

const refNames = (spec) => new Set(spec.columns.filter((c) => c.kind === 'ref').map((c) => c.ref));

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

// Excel cell rules. Excel checks these as the admin types; the server repeats
// every check on upload because pasted values skip Excel's rules.
function excelRule(c, cell, listRange) {
  const base = { allowBlank: !c.required, showErrorMessage: true, errorStyle: 'stop', errorTitle: c.header, showInputMessage: Boolean(c.help) };
  const withPrompt = (rule, error) => ({ ...base, promptTitle: c.header, prompt: c.help || '', error, ...rule });
  switch (c.kind) {
    case 'list':
      return withPrompt({ type: 'list', formulae: [`"${c.options.join(',')}"`] }, 'Pick one of the options in the list.');
    case 'ref':
      return withPrompt({ type: 'list', formulae: [listRange] }, 'Pick one of the options in the list.');
    case 'int':
      return withPrompt({ type: 'whole', operator: 'between', formulae: [c.min, c.max] }, `Enter a whole number from ${c.min} to ${c.max}.`);
    case 'decimal':
      return withPrompt({ type: 'decimal', operator: 'between', formulae: [c.min, c.max] }, `Enter a number from ${c.min} to ${c.max}.`);
    case 'date':
      return withPrompt(
        { type: 'date', operator: 'between', formulae: [new Date(Date.UTC(1940, 0, 1)), new Date(Date.UTC(2060, 11, 31))] },
        'Enter a date as DD/MM/YYYY.'
      );
    case 'phone':
      return withPrompt(
        { type: 'custom', formulae: [`AND(LEN(${cell})=10,LEFT(${cell},1)="0",ISNUMBER(--${cell}))`] },
        'Enter 10 digits starting with 0, e.g. 0244123456.'
      );
    case 'email':
      return withPrompt(
        { type: 'custom', formulae: [`AND(ISNUMBER(SEARCH("@",${cell})),ISNUMBER(SEARCH(".",${cell},SEARCH("@",${cell}))),ISERROR(SEARCH(" ",${cell})))`] },
        'Enter a valid email, e.g. name@gmail.com.'
      );
    case 'plate':
      return withPrompt(
        { type: 'custom', formulae: [`AND(LEN(${cell})>=6,LEN(${cell})<=12,EXACT(${cell},UPPER(${cell})),LEN(${cell})-LEN(SUBSTITUTE(${cell},"-",""))=2)`] },
        'Use capital letters in the format GR-1234-20.'
      );
    case 'license':
      return withPrompt(
        { type: 'custom', formulae: [`AND(LEN(${cell})>=6,LEN(${cell})<=20,EXACT(${cell},UPPER(${cell})),ISERROR(SEARCH(" ",${cell})))`] },
        'Use 6-20 capital letters and numbers, e.g. GH-DL-29831.'
      );
    case 'gps':
      return withPrompt(
        { type: 'custom', formulae: [`AND(LEN(${cell})=11,MID(${cell},3,1)="-",MID(${cell},7,1)="-",EXACT(${cell},UPPER(${cell})))`] },
        'Use the GhanaPost GPS format, e.g. GA-543-0125.'
      );
    case 'name':
      return withPrompt({ type: 'textLength', operator: 'between', formulae: [2, 50] }, 'Enter a name of 2 to 50 letters.');
    case 'text':
      return withPrompt({ type: 'textLength', operator: 'between', formulae: [c.min || 1, c.max || 200] }, `Enter ${c.min || 1} to ${c.max || 200} characters.`);
    default:
      return null;
  }
}

const KIND_HELP = {
  text: 'Text',
  name: 'Letters only',
  list: 'Pick from the dropdown',
  ref: 'Pick from the dropdown',
  phone: '10 digits starting with 0',
  email: 'Email address',
  plate: 'Format GR-1234-20 or GT-881-Z',
  license: 'Capital letters and numbers',
  gps: 'Format GA-543-0125',
  int: 'Whole number',
  decimal: 'Number',
  date: 'Date, DD/MM/YYYY',
  time: 'Time, e.g. 06:00',
};

export async function buildTemplate(entity, schoolName = '') {
  const spec = SPECS[entity];
  const refs = await loadRefs(refNames(spec));
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AwaBus';
  wb.created = new Date();

  // --- Instructions ---------------------------------------------------------
  const info = wb.addWorksheet('Instructions', { properties: { tabColor: { argb: BRAND } } });
  info.columns = [{ width: 30 }, { width: 13 }, { width: 34 }, { width: 58 }, { width: 34 }];
  const title = info.addRow([`AwaBus bulk upload: ${spec.label}${schoolName ? ` (${schoolName})` : ''}`]);
  title.font = { bold: true, size: 16, color: { argb: BRAND } };
  info.addRow([spec.intro]);
  info.addRow([]);
  const steps = [
    `1. Fill in the "${spec.sheet}" sheet, one ${spec.singular} per row, starting on row 2.`,
    '2. Columns marked * (yellow headers) are mandatory. If a row is started, its empty mandatory cells turn red.',
    '3. Use the dropdowns where a column has one. Do not rename, reorder or delete the columns.',
    '4. Save the file (keep it as .xlsx) and upload it on the same page in AwaBus.',
    '5. AwaBus checks every row first. Nothing is imported until the whole file is correct, and it tells you the row and column of every problem.',
    `6. At most ${MAX_ROWS} rows per file. Import in this order: Routes, then Buses, then Drivers, then Students.`,
    '7. The dropdown lists are copied from AwaBus when you download. After importing routes or buses, download a fresh template.',
  ];
  steps.forEach((s) => info.addRow([s]));
  info.addRow([]);
  const head = info.addRow(['Column', 'Mandatory?', 'What to enter', 'Details', 'Example']);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
  });
  spec.columns.forEach((c) => {
    const row = info.addRow([
      c.header,
      c.required ? 'Yes' : 'No',
      KIND_HELP[c.kind] + (c.kind === 'list' ? `: ${c.options.join(', ')}` : ''),
      c.help || '',
      c.example instanceof Date ? c.example : String(c.example ?? ''),
    ]);
    row.alignment = { wrapText: true, vertical: 'top' };
    if (c.required) row.getCell(2).font = { bold: true, color: { argb: 'FFB91C1C' } };
  });

  // --- Hidden lists for the dropdowns ---------------------------------------
  const lists = wb.addWorksheet('Lists', { state: 'hidden' });
  const listRanges = {};
  let listCol = 0;
  for (const name of refNames(spec)) {
    listCol += 1;
    const options = (refs[name] || []).filter((o) => !o.taken).map((o) => o.label);
    const values = options.length ? options : ['(none available - add them in AwaBus first)'];
    const letter = colLetter(listCol);
    lists.getCell(`${letter}1`).value = name;
    values.forEach((v, i) => {
      lists.getCell(`${letter}${i + 2}`).value = v;
    });
    listRanges[name] = `Lists!$${letter}$2:$${letter}$${values.length + 1}`;
  }

  // --- Data sheet -------------------------------------------------------------
  const ws = wb.addWorksheet(spec.sheet, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = spec.columns.map((c) => ({
    key: c.key,
    width: Math.max(16, Math.min(40, headerText(c).length + 6, String(c.example ?? '').length + 6)),
    style: ['phone', 'plate', 'license', 'gps', 'text', 'name', 'email'].includes(c.kind)
      ? { numFmt: '@' }
      : c.kind === 'date'
        ? { numFmt: 'dd/mm/yyyy' }
        : {},
  }));
  const header = ws.getRow(1);
  spec.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = headerText(c);
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.required ? REQUIRED_FILL : OPTIONAL_FILL } };
    cell.note = [c.required ? 'Mandatory.' : 'Optional.', c.help || KIND_HELP[c.kind], `Example: ${c.example}`].join('\n');
  });
  header.height = 30;

  const last = colLetter(spec.columns.length);
  spec.columns.forEach((c, i) => {
    const letter = colLetter(i + 1);
    const range = `${letter}2:${letter}${DATA_ROWS + 1}`;
    const rule = excelRule(c, `${letter}2`, listRanges[c.ref]);
    if (rule) ws.dataValidations.add(range, rule);
    if (c.required) {
      ws.addConditionalFormatting({
        ref: range,
        rules: [
          {
            type: 'expression',
            priority: 1,
            formulae: [`AND(COUNTA($A2:$${last}2)>0,LEN(TRIM(${letter}2))=0)`],
            style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: MISSING_FILL } } },
          },
        ],
      });
    }
  });

  wb.views = [{ activeTab: 2 }];
  return wb.xlsx.writeBuffer();
}

// ---------------------------------------------------------------------------
// Reading and checking an uploaded file
// ---------------------------------------------------------------------------

// Plain value from an ExcelJS cell (rich text, hyperlinks and formulas included).
function cellValue(v) {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return cellValue(v.text);
    if ('error' in v) return null;
  }
  return v;
}

const isoDate = (d) => d.toISOString().slice(0, 10);

function parseDate(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : isoDate(v);
  if (typeof v === 'number') {
    // Excel serial date number
    return isoDate(new Date(Math.round((v - 25569) * 86400 * 1000)));
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // DD/MM/YYYY
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return d.getUTCDate() === +m[1] && d.getUTCMonth() === +m[2] - 1 ? isoDate(d) : null;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); // YYYY-MM-DD
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCDate() === +m[3] ? isoDate(d) : null;
  }
  return null;
}

// Returns { value } or { error } for one cell.
function checkCell(c, raw, refs) {
  const text = raw instanceof Date ? '' : String(raw ?? '').trim();
  if (raw == null || (!(raw instanceof Date) && text === '')) {
    return c.required ? { error: 'Mandatory: this cell is empty' } : { value: undefined };
  }
  switch (c.kind) {
    case 'text':
      if (c.min && text.length < c.min) return { error: `must be at least ${c.min} characters` };
      if (c.max && text.length > c.max) return { error: `must be at most ${c.max} characters` };
      return { value: text };
    case 'name': {
      const s = text.replace(/\s{2,}/g, ' ');
      if (!NAME_RE.test(s) || s.length < 2 || s.length > 50) return { error: 'must be 2-50 letters (spaces, - and \' allowed)' };
      return { value: s };
    }
    case 'list': {
      const hit = c.options.find((o) => o.toLowerCase() === text.toLowerCase());
      return hit ? { value: hit } : { error: `must be one of: ${c.options.join(', ')}` };
    }
    case 'ref': {
      const options = refs[c.ref] || [];
      const code = normalizeCode(text.split(' - ')[0]);
      let hit = options.find((o) => normalizeCode(o.code) === code);
      if (!hit) {
        // A route can also be given by its name alone (e.g. "Adenta - Madina"),
        // so files can be prepared before the route IDs are known.
        const byName = options.filter((o) => o.name && o.name.trim().toLowerCase() === text.replace(/\s+/g, ' ').toLowerCase());
        if (byName.length > 1) return { error: `more than one route is called "${text}". Pick from the dropdown` };
        [hit] = byName;
      }
      if (!hit) return { error: `"${text}" was not found in AwaBus. Pick from the dropdown` };
      if (hit.taken) return { error: `${hit.label} ${hit.takenMessage}` };
      return { value: hit.id, label: hit.label };
    }
    case 'phone':
      return isValidGhanaPhone(text) ? { value: normalizeGhanaPhone(text) } : { error: 'must be 10 digits starting with 0, e.g. 0244123456' };
    case 'email': {
      const s = text.toLowerCase();
      return EMAIL_RE.test(s) ? { value: s } : { error: 'is not a valid email address' };
    }
    case 'plate':
    case 'license': {
      const s = c.kind === 'plate' ? normalizePlate(text) : normalizeLicense(text);
      const problem = formatProblem(c.kind === 'plate' ? 'plateNumber' : 'licenseNumber', s);
      return problem ? { error: problem.replace(/^(Plate number|License number) /, '') } : { value: s };
    }
    case 'gps': {
      const s = normalizeCode(text);
      return GPS_RE.test(s) ? { value: s } : { error: 'must look like GA-543-0125' };
    }
    case 'int': {
      const n = Number(text);
      return Number.isInteger(n) && n >= c.min && n <= c.max ? { value: n } : { error: `must be a whole number from ${c.min} to ${c.max}` };
    }
    case 'decimal': {
      const n = Number(text);
      return Number.isFinite(n) && n >= c.min && n <= c.max ? { value: n } : { error: `must be a number from ${c.min} to ${c.max}` };
    }
    case 'time': {
      const t = parseTime(raw instanceof Date ? raw : typeof raw === 'number' ? raw : text);
      return t ? { value: t } : { error: 'must be a time of day, e.g. 06:00 or 3:30 PM' };
    }
    case 'date': {
      const iso = parseDate(raw);
      if (!iso) return { error: 'must be a date as DD/MM/YYYY' };
      const problem = formatProblem(c.rule, iso);
      return problem ? { error: problem.replace(/^Enter a valid date of birth$/, 'is not a valid date of birth') } : { value: iso };
    }
    default:
      return { value: text };
  }
}

// Checks that need the whole file and the database (duplicates, one-per rules).
async function crossChecks(entity, rows, addError) {
  const seen = (key, rowNo, value, column, message) => {
    if (!value) return;
    const k = `${key}:${String(value).toLowerCase()}`;
    if (seen.map.has(k)) addError(rowNo, column, `${message} (same as row ${seen.map.get(k)})`);
    else seen.map.set(k, rowNo);
  };
  seen.map = new Map();

  if (entity === 'routes') {
    const names = rows.map((r) => r.data.name).filter(Boolean);
    const existing = await Route.find({ name: { $in: names.map((n) => new RegExp(`^${escapeRe(n)}$`, 'i')) } }).select('name routeId').lean();
    const taken = new Map(existing.map((r) => [r.name.toLowerCase(), r.routeId]));
    rows.forEach((r) => {
      if (!r.data.name) return;
      if (taken.has(r.data.name.toLowerCase())) addError(r.rowNo, 'Route Name', `already exists in AwaBus as ${taken.get(r.data.name.toLowerCase())}`);
      seen('name', r.rowNo, r.data.name, 'Route Name', 'is listed twice');
    });
  }

  if (entity === 'buses') {
    const plates = rows.map((r) => r.data.plateNumber).filter(Boolean);
    const existing = new Set((await Bus.find({ plateNumber: { $in: plates } }).select('plateNumber').lean()).map((b) => b.plateNumber));
    rows.forEach((r) => {
      if (existing.has(r.data.plateNumber)) addError(r.rowNo, 'Plate Number', 'is already registered in AwaBus');
      seen('plate', r.rowNo, r.data.plateNumber, 'Plate Number', 'is listed twice');
      seen('route', r.rowNo, r.data.route && String(r.data.route), 'Route', 'already has a bus in this file. A route can only have one bus');
    });
  }

  if (entity === 'drivers') {
    const phones = rows.map((r) => r.data.phone).filter(Boolean);
    const licenses = rows.map((r) => r.data.licenseNumber).filter(Boolean);
    const [byPhone, byLicense] = await Promise.all([
      Driver.find({ phone: { $in: phones.flatMap(ghanaPhoneVariants) } }).select('phone firstName lastName').lean(),
      Driver.find({ licenseNumber: { $in: licenses } }).select('licenseNumber firstName lastName').lean(),
    ]);
    const phoneOwner = new Map(byPhone.map((d) => [normalizeGhanaPhone(d.phone), `${d.firstName} ${d.lastName}`]));
    const licenseOwner = new Map(byLicense.map((d) => [d.licenseNumber, `${d.firstName} ${d.lastName}`]));
    rows.forEach((r) => {
      if (phoneOwner.has(r.data.phone)) addError(r.rowNo, 'Phone Number', `is already used by driver ${phoneOwner.get(r.data.phone)}`);
      if (licenseOwner.has(r.data.licenseNumber)) addError(r.rowNo, 'License Number', `is already saved for driver ${licenseOwner.get(r.data.licenseNumber)}`);
      seen('phone', r.rowNo, r.data.phone, 'Phone Number', 'is listed twice');
      seen('license', r.rowNo, r.data.licenseNumber, 'License Number', 'is listed twice');
      seen('bus', r.rowNo, r.data.bus && String(r.data.bus), 'Assigned Bus', 'already has a driver in this file. A bus can only have one driver');
    });
  }

  if (entity === 'students') {
    // The same child under the same parent phone would be a duplicate import.
    const phones = [...new Set(rows.map((r) => r.data.guardianPhone).filter(Boolean))];
    const guardians = await Guardian.find({ phone: { $in: phones.flatMap(ghanaPhoneVariants) } }).select('_id phone').lean();
    const phoneOf = new Map(guardians.map((g) => [String(g._id), normalizeGhanaPhone(g.phone)]));
    const existing = guardians.length
      ? await Student.find({ primaryGuardian: { $in: guardians.map((g) => g._id) } }).select('firstName lastName primaryGuardian studentCode').lean()
      : [];
    const known = new Map(
      existing.map((s) => [`${s.firstName} ${s.lastName}|${phoneOf.get(String(s.primaryGuardian))}`.toLowerCase(), s.studentCode])
    );
    rows.forEach((r) => {
      const key = `${r.data.firstName} ${r.data.lastName}|${r.data.guardianPhone}`.toLowerCase();
      if (known.has(key)) addError(r.rowNo, 'First Name', `this student is already in AwaBus (${known.get(key)})`);
      seen('student', r.rowNo, key, 'First Name', 'this student is listed twice');
      const hasLat = r.data.lat !== undefined || r.bad.has('lat');
      const hasLng = r.data.lng !== undefined || r.bad.has('lng');
      if (hasLat !== hasLng) addError(r.rowNo, hasLat ? 'Home Longitude' : 'Home Latitude', 'is needed when the other coordinate is filled in');
    });
  }
}

/**
 * Reads an uploaded template and checks every row.
 * Returns { rows: [{ rowNo, data, labels }], errors: [{ row, column, message }], fileError }.
 */
export async function readUpload(entity, buffer) {
  const spec = SPECS[entity];
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return { fileError: 'This file could not be opened. Save it as an Excel workbook (.xlsx) and try again.' };
  }
  const ws = wb.getWorksheet(spec.sheet);
  if (!ws) {
    return { fileError: `This isn't the AwaBus ${spec.label.toLowerCase()} template: there is no "${spec.sheet}" sheet. Download the template and fill that in.` };
  }

  const clean = (h) => String(cellValue(h) ?? '').replace(/\*/g, '').trim().toLowerCase();
  const header = ws.getRow(1);
  // Columns added to a template later may be missing from files made with an
  // older copy of it; those are simply treated as blank.
  const mismatch = spec.columns.find((c, i) => {
    const h = clean(header.getCell(i + 1).value);
    return !(c.addedLater && h === '') && h !== c.header.toLowerCase();
  });
  if (mismatch) {
    return { fileError: `The columns have been changed (expected "${mismatch.header}" in column ${colLetter(spec.columns.indexOf(mismatch) + 1)}). Download a fresh template and copy your rows into it.` };
  }

  const refs = await loadRefs(refNames(spec));
  const rows = [];
  const errors = [];
  const addError = (row, column, message) => errors.push({ row, column, message });

  const filled = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNo) => {
    if (rowNo > 1) filled.push(row);
  });
  for (const row of filled) {
    const rowNo = row.number;
    const raws = spec.columns.map((c, i) => cellValue(row.getCell(i + 1).value));
    const blank = raws.every((v) => v == null || (!(v instanceof Date) && String(v).trim() === ''));
    if (blank) continue;
    if (rows.length >= MAX_ROWS) {
      return { fileError: `This file has more than ${MAX_ROWS} rows. Split it into smaller files.` };
    }
    const data = {};
    const labels = {};
    const bad = new Set();
    spec.columns.forEach((c, i) => {
      const res = checkCell(c, raws[i], refs);
      if (res.error) {
        addError(rowNo, c.header, res.error);
        bad.add(c.key);
      }
      else if (res.value !== undefined) {
        data[c.key] = res.value;
        if (res.label) labels[c.key] = res.label;
      }
    });
    rows.push({ rowNo, data, labels, bad });
  }

  if (!rows.length) return { fileError: `The "${spec.sheet}" sheet has no rows filled in yet.` };
  await crossChecks(entity, rows, addError);
  errors.sort((a, b) => a.row - b.row);
  return { rows, errors };
}

// A short, readable line per row for the preview table.
export function describeRow(entity, r) {
  const d = r.data;
  if (entity === 'routes') return d.name;
  if (entity === 'buses') return `${d.plateNumber} · ${d.name} · ${r.labels.route || ''}`;
  if (entity === 'drivers') return `${d.firstName} ${d.lastName} · ${d.licenseNumber} · ${r.labels.bus || ''}`;
  return `${d.firstName} ${d.lastName} · ${r.labels.route || ''} · parent ${d.guardianFirst} ${d.guardianLast}`;
}

// Turns a checked row into the body the normal create endpoint expects.
export async function toCreateBody(entity, d) {
  if (entity === 'routes') return { name: d.name, status: d.status, morningStartTime: d.morningStartTime, eveningStartTime: d.eveningStartTime };
  if (entity === 'buses') {
    return { plateNumber: d.plateNumber, name: d.name, type: d.type, capacity: d.capacity, assignedRoute: d.route, status: d.status };
  }
  if (entity === 'drivers') {
    const { bus, ...rest } = d;
    return {
      ...rest,
      assignedBus: bus,
      licenseValidation: { status: 'verified', message: 'License details saved', checkedAt: new Date() },
    };
  }
  // students: reuse the parent if one with this phone already exists (siblings)
  const existing = await Guardian.findOne({ phone: { $in: ghanaPhoneVariants(d.guardianPhone) } }).select('_id');
  const language = d.guardianLanguage ? normalizeLanguage(d.guardianLanguage) : undefined;
  const guardian = existing
    ? { id: existing._id, preferredLanguage: language }
    : {
        firstName: d.guardianFirst,
        lastName: d.guardianLast,
        relation: d.guardianRelation || 'Guardian',
        phone: d.guardianPhone,
        email: d.guardianEmail,
        preferredLanguage: language,
      };
  return {
    firstName: d.firstName,
    lastName: d.lastName,
    dob: d.dob,
    gender: d.gender,
    classGrade: d.classGrade,
    route: d.route,
    guardian,
    secondContactName: d.secondContactName,
    secondContactPhone: d.secondContactPhone,
    pickupPoint: d.pickupPoint,
    dropoffPoint: d.dropoffPoint,
    homeAddress: d.homeAddress,
    lat: d.lat,
    lng: d.lng,
    geofenceRadius: d.geofenceRadius ?? 200,
    emergencyInstructions: d.emergencyInstructions,
    rideSession: d.rideSession,
    ...(d.arrivalCalls ? { arrivalCalls: d.arrivalCalls } : {}),
  };
}
