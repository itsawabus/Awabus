import asyncHandler from 'express-async-handler';
import School from '../models/School.js';
import { tenantContext } from '../utils/tenantContext.js';
import { inGhana } from '../utils/geo.js';
import { forgetSchoolLocation } from '../services/schoolArrival.js';

const FIELDS = 'name code address gpsAddress lat lng arrivalRadius autoAtSchool';
const findSchool = (id) => tenantContext.runAsSystem(() => School.findById(id).select(FIELDS).lean());

// @desc    This school's details and location (for "At school" automatically)
// @route   GET /api/school
export const getMySchool = asyncHandler(async (req, res) => {
  const school = await findSchool(req.school);
  if (!school) {
    res.status(404);
    throw new Error('School not found');
  }
  res.json({ success: true, data: school });
});

// @desc    Set where the school is: GPS address + coordinates, arrival zone, on/off
// @route   PUT /api/school/location   body: { gpsAddress, lat, lng, arrivalRadius, autoAtSchool }
export const updateSchoolLocation = asyncHandler(async (req, res) => {
  const { gpsAddress, lat, lng, arrivalRadius, autoAtSchool } = req.body || {};
  const set = {};
  if (lat !== undefined || lng !== undefined) {
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln) || !inGhana(la, ln)) {
      res.status(400);
      throw new Error('The school location must be a place in Ghana. Look up the GPS address first.');
    }
    set.lat = la;
    set.lng = ln;
  }
  if (gpsAddress !== undefined) {
    const addr = String(gpsAddress || '').trim().toUpperCase();
    if (addr && !/^[A-Z]{2}-\d{3}-\d{4}$/.test(addr)) {
      res.status(400);
      throw new Error('GPS address must look like GA-123-4567');
    }
    set.gpsAddress = addr;
  }
  if (arrivalRadius !== undefined) {
    const r = Number(arrivalRadius);
    if (!Number.isInteger(r) || r < 50 || r > 1000) {
      res.status(400);
      throw new Error('The arrival zone must be between 50 and 1000 metres');
    }
    set.arrivalRadius = r;
  }
  if (autoAtSchool !== undefined) set.autoAtSchool = Boolean(autoAtSchool);
  await tenantContext.runAsSystem(() => School.updateOne({ _id: req.school }, { $set: set }));
  forgetSchoolLocation(req.school);
  res.json({ success: true, data: await findSchool(req.school) });
});
