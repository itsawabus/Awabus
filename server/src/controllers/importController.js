import asyncHandler from 'express-async-handler';
import School from '../models/School.js';
import { createRoute } from './routeController.js';
import { createBus } from './busController.js';
import { createDriver } from './driverController.js';
import { createStudent } from './studentController.js';
import { SPECS } from '../import/specs.js';
import { buildTemplate, describeRow, readUpload, toCreateBody } from '../import/importer.js';
import { notify } from '../services/notify.js';

const CREATE = { routes: createRoute, buses: createBus, drivers: createDriver, students: createStudent };

function specFor(req, res) {
  const spec = SPECS[req.params.entity];
  if (!spec) {
    res.status(404);
    throw new Error('Bulk upload is available for routes, buses, drivers and students');
  }
  return spec;
}

// Runs one of the normal "create" endpoints for a single row, so imported
// records go through exactly the same rules and side effects as the forms.
async function runCreate(handler, req, body) {
  const inner = Object.create(req);
  inner.body = body;
  inner.params = {};
  inner.query = {};
  let failure = null;
  let payload = null;
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      payload = data;
      return this;
    },
  };
  await handler(inner, res, (err) => {
    failure = err;
  });
  if (failure) throw failure;
  return payload?.data;
}

// @desc    Download the Excel template for bulk upload
// @route   GET /api/import/:entity/template
export const downloadTemplate = asyncHandler(async (req, res) => {
  const spec = specFor(req, res);
  const school = req.admin?.school ? await School.findById(req.admin.school).select('name').lean() : null;
  const buffer = await buildTemplate(req.params.entity, school?.name);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="awabus-${req.params.entity}-template.xlsx"`);
  res.send(Buffer.from(buffer));
});

// @desc    Check (and with ?commit=1, import) a filled-in template
// @route   POST /api/import/:entity   (body: the .xlsx file)
export const uploadFile = asyncHandler(async (req, res) => {
  const spec = specFor(req, res);
  const entity = req.params.entity;
  if (!Buffer.isBuffer(req.body) || !req.body.length) {
    res.status(400);
    throw new Error('Choose the filled-in Excel file to upload');
  }

  const { rows, errors, fileError } = await readUpload(entity, req.body);
  if (fileError) return res.json({ success: true, ok: false, fileError, errors: [], total: 0 });

  const preview = rows.slice(0, 50).map((r) => ({ row: r.rowNo, summary: describeRow(entity, r) }));
  const summary = { entity, label: spec.label, total: rows.length, preview, errors };

  if (errors.length || req.query.commit !== '1') {
    return res.json({ success: true, ok: errors.length === 0, ...summary });
  }

  // Everything checked out: create the rows one by one, in file order.
  const created = [];
  const failed = [];
  for (const r of rows) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const doc = await runCreate(CREATE[entity], req, await toCreateBody(entity, r.data));
      created.push({ row: r.rowNo, id: doc?._id });
    } catch (err) {
      failed.push({ row: r.rowNo, column: '', message: err.message });
    }
  }
  const SINGULAR = { routes: 'route', buses: 'bus', drivers: 'driver', students: 'student' };
  const what = created.length === 1 ? SINGULAR[entity] : spec.label.toLowerCase();
  await notify({
    type: 'bulk_upload',
    title: failed.length ? `Bulk upload finished with problems` : `Bulk upload finished`,
    message: `${created.length} ${what} added${failed.length ? `, ${failed.length} row${failed.length === 1 ? '' : 's'} could not be added` : ''}. Uploaded by ${req.admin.name}.`,
    link: `/${entity}`,
  });
  res.json({ success: true, ok: failed.length === 0, committed: true, ...summary, created: created.length, errors: failed });
});
