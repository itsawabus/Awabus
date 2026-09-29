import asyncHandler from 'express-async-handler';
import { isValidGhanaPhone, normalizeGhanaPhone } from '../utils/phone.js';
import Driver, { ONLINE_WINDOW_MS } from '../models/Driver.js';
import Bus from '../models/Bus.js';
import Route from '../models/Route.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { assertFormats, formatProblem, ifChanged, normalizeLicense } from '../utils/formats.js';
import { searchPattern } from '../utils/search.js';
import { issueSetupCode } from '../utils/setupCode.js';

const populateDriver = (query) =>
  query
    .populate('assignedBus', 'plateNumber name capacity')
    .populate('assignedRoute', 'routeId name');

// Which of these drivers have chosen a password (signed in to the driver app
// at least once). The password itself never leaves the server.
async function withAccountState(drivers) {
  const ids = drivers.map((d) => d._id);
  const pending = new Set(
    (await Driver.find({ _id: { $in: ids }, password: { $in: ['', null] } }).select('_id').lean()).map((d) => String(d._id))
  );
  return drivers.map((d) => ({ ...d.toJSON(), accountSetUp: !pending.has(String(d._id)) }));
}

// A bus (and so its route) has exactly one driver. The drivers collection is
// the source of truth, so look for any other driver already holding the bus.
async function assertBusFree(res, busId, driverId = null) {
  const filter = { assignedBus: busId };
  if (driverId) filter._id = { $ne: driverId };
  const holder = await Driver.findOne(filter).select('firstName lastName');
  if (holder) {
    res.status(409);
    throw new Error(
      `This bus already has a driver (${holder.firstName} ${holder.lastName}). A bus and its route can only have one driver — unassign or move that driver first.`
    );
  }
}

// @desc    List drivers (search + pagination)
// @route   GET /api/drivers   (also returns overview stats for the cards)
export const getDrivers = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const { page, limit, skip } = getPagination(req.query, 8);

  const filter = {};
  if (q) {
    filter.$or = [
      { firstName: { $regex: searchPattern(q), $options: 'i' } },
      { lastName: { $regex: searchPattern(q), $options: 'i' } },
      { licenseNumber: { $regex: searchPattern(q), $options: 'i' } },
      { phone: { $regex: searchPattern(q), $options: 'i' } },
    ];
  }

  // Licenses expiring within 30 days (or already expired) need renewing soon.
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const [drivers, total, totalDrivers, active, withoutBus, licenseAlerts, recentlySeen] = await Promise.all([
    populateDriver(Driver.find(filter)).sort({ createdAt: 1 }).skip(skip).limit(limit),
    Driver.countDocuments(filter),
    Driver.countDocuments(),
    Driver.countDocuments({ status: 'Active' }),
    Driver.countDocuments({ assignedBus: null }),
    Driver.countDocuments({ licenseExpiry: { $ne: null, $lte: soon } }),
    Driver.find({ lastSeenAt: { $gte: new Date(Date.now() - ONLINE_WINDOW_MS) } }).select('lastSeenAt signedOutAt'),
  ]);

  res.json({
    success: true,
    data: await withAccountState(drivers),
    meta: buildPaginationMeta(total, page, limit),
    stats: { totalDrivers, active, withoutBus, licenseAlerts, online: recentlySeen.filter((d) => d.online).length },
  });
});

// Every driver needs someone to call in an emergency: a name, how they are
// related, and a valid phone number.
function assertEmergencyContact(res, { emergencyContactName, emergencyContactRelation, emergencyContactPhone }) {
  const missing = [
    !String(emergencyContactName || '').trim() && 'name',
    !String(emergencyContactRelation || '').trim() && 'relation',
    !String(emergencyContactPhone || '').trim() && 'phone number',
  ].filter(Boolean);
  if (missing.length) {
    res.status(400);
    throw new Error(`The emergency contact is required: add their ${missing.join(', ')}`);
  }
  if (!isValidGhanaPhone(emergencyContactPhone)) {
    res.status(400);
    throw new Error('The emergency contact phone must be 10 digits starting with 0, e.g. 020 111 2233');
  }
}

// @desc    Get driver profile (details + assignment history)
// @route   GET /api/drivers/:id
export const getDriverById = asyncHandler(async (req, res) => {
  const driver = await populateDriver(
    Driver.findById(req.params.id).populate({
      path: 'assignmentHistory.bus',
      select: 'plateNumber name',
    }).populate({
      path: 'assignmentHistory.route',
      select: 'routeId name',
    })
  );
  if (!driver) {
    res.status(404);
    throw new Error('Driver not found');
  }
  res.json({ success: true, data: (await withAccountState([driver]))[0] });
});

// @desc    Check the license details entered in the Add Driver wizard (step 3).
//          This is a local check only (format, expiry, not already used by
//          another driver in this school) - AwaBus does not contact the DVLA.
// @route   POST /api/drivers/validate-license
export const validateLicense = asyncHandler(async (req, res) => {
  const licenseNumber = normalizeLicense(req.body.licenseNumber);
  const { licenseExpiry } = req.body;

  if (!licenseNumber) {
    res.status(400);
    throw new Error('License number is required');
  }

  const errors = {};
  const formatIssue = formatProblem('licenseNumber', licenseNumber);
  if (formatIssue) errors.licenseNumber = formatIssue;
  if (!licenseExpiry) {
    errors.licenseExpiry = 'Enter the license expiry date.';
  } else if (new Date(licenseExpiry) < new Date(new Date().toDateString())) {
    errors.licenseExpiry = 'This license has expired.';
  }
  if (!errors.licenseNumber && (await Driver.exists({ licenseNumber }))) {
    errors.licenseNumber = 'This license number is already saved for another driver.';
  }

  if (Object.keys(errors).length > 0) {
    return res.json({
      success: true,
      valid: false,
      message: 'Some license details need fixing before you continue.',
      errors,
    });
  }

  res.json({ success: true, valid: true, message: 'License details saved' });
});

// @desc    Create driver (final step of Add Driver wizard)
// @route   POST /api/drivers
export const createDriver = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    phone,
    email,
    dob,
    gender,
    profilePhotoUrl,
    licenseNumber,
    licenseExpiry,
    licenseClass,
    licenseValidation,
    assignedBus,
    emergencyContactName,
    emergencyContactRelation,
    emergencyContactPhone,
    residentialAddress,
    status,
  } = req.body;

  if (!firstName || !lastName || !phone || !licenseNumber || !licenseExpiry) {
    res.status(400);
    throw new Error('First name, last name, phone, license number and license expiry are required');
  }
  assertFormats(res, { licenseNumber, email, driverDob: dob, licenseExpiry });
  assertEmergencyContact(res, { emergencyContactName, emergencyContactRelation, emergencyContactPhone });
  if (!assignedBus) {
    res.status(400);
    throw new Error('A driver must be assigned to a bus — register a bus first if none exist yet');
  }

  const bus = await Bus.findById(assignedBus);
  if (!bus) {
    res.status(400);
    throw new Error('Selected bus was not found');
  }
  if (!bus.assignedRoute) {
    res.status(400);
    throw new Error('This bus is not yet assigned to a route — assign it to a route before assigning a driver');
  }
  await assertBusFree(res, bus._id);

  // The driver's route is derived from the bus, not chosen independently —
  // a bus can only ever be on one route (enforced at bus creation), so this
  // is always correct and can never drift out of sync with the bus.
  const assignedRoute = bus.assignedRoute;

  const driver = await Driver.create({
    firstName,
    lastName,
    phone: normalizeGhanaPhone(phone),
    email,
    dob,
    gender,
    profilePhotoUrl,
    licenseNumber: normalizeLicense(licenseNumber),
    licenseExpiry,
    licenseClass,
    licenseValidation: licenseValidation || { status: 'verified', message: 'License details saved', checkedAt: new Date() },
    assignedBus,
    assignedRoute,
    assignmentHistory: [{ bus: assignedBus, route: assignedRoute, from: new Date(), status: 'Active' }],
    emergencyContactName,
    emergencyContactRelation,
    emergencyContactPhone: normalizeGhanaPhone(emergencyContactPhone),
    residentialAddress,
    status: status || 'Active',
  });
  // The driver needs this code to choose a password in the driver app.
  // It is shown to the admin once, here, and only a hash is stored.
  const setup = issueSetupCode(driver);
  await driver.save();

  await Bus.findByIdAndUpdate(assignedBus, { assignedDriver: driver._id });
  await Route.findByIdAndUpdate(assignedRoute, { assignedDriver: driver._id });

  const populated = await populateDriver(Driver.findById(driver._id));
  res.status(201).json({ success: true, data: { ...populated.toJSON(), accountSetUp: false }, ...setup });
});

// @desc    New setup code for a driver who has not chosen a password yet
//          (lost the first one, it expired, or they were added by bulk upload)
// @route   POST /api/drivers/:id/setup-code
export const createDriverSetupCode = asyncHandler(async (req, res) => {
  const driver = await Driver.findById(req.params.id).select('+password firstName lastName phone');
  if (!driver) {
    res.status(404);
    throw new Error('Driver not found');
  }
  if (driver.password) {
    res.status(409);
    throw new Error('This driver has already set up the app. If they forgot their password, they can use "Forgot password" in the app.');
  }
  const setup = issueSetupCode(driver);
  await driver.save();
  res.json({ success: true, ...setup });
});

// @desc    Update driver
// @route   PUT /api/drivers/:id
export const updateDriver = asyncHandler(async (req, res) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) {
    res.status(404);
    throw new Error('Driver not found');
  }

  const fields = [
    'firstName',
    'lastName',
    'phone',
    'email',
    'dob',
    'gender',
    'profilePhotoUrl',
    'licenseNumber',
    'licenseExpiry',
    'licenseClass',
    'emergencyContactName',
    'emergencyContactRelation',
    'emergencyContactPhone',
    'residentialAddress',
    'status',
  ];
  // Only new or changed values are checked, so records saved before these rules
  // (e.g. an old expired license, which the profile flags) can still be edited.
  assertFormats(res, {
    licenseNumber: ifChanged(req.body.licenseNumber, driver.licenseNumber),
    email: ifChanged(req.body.email, driver.email),
    driverDob: ifChanged(req.body.dob, driver.dob),
    licenseExpiry: ifChanged(req.body.licenseExpiry, driver.licenseExpiry),
  });
  // Changes may not leave the emergency contact incomplete.
  const emergencyChange = ['emergencyContactName', 'emergencyContactRelation', 'emergencyContactPhone'];
  if (emergencyChange.some((f) => req.body[f] !== undefined)) {
    assertEmergencyContact(res, Object.fromEntries(emergencyChange.map((f) => [f, req.body[f] !== undefined ? req.body[f] : driver[f]])));
  }
  fields.forEach((f) => {
    if (req.body[f] !== undefined) driver[f] = req.body[f];
  });
  if (req.body.licenseNumber !== undefined) driver.licenseNumber = normalizeLicense(req.body.licenseNumber);
  if (req.body.phone !== undefined) driver.phone = normalizeGhanaPhone(req.body.phone);
  if (req.body.emergencyContactPhone !== undefined) {
    driver.emergencyContactPhone = normalizeGhanaPhone(req.body.emergencyContactPhone);
  }

  const previousBus = driver.assignedBus ? String(driver.assignedBus) : null;
  const previousRoute = driver.assignedRoute ? String(driver.assignedRoute) : null;
  let busChanged = false;

  if (req.body.assignedBus !== undefined) {
    const newBusId = req.body.assignedBus || null;
    if (newBusId) {
      const bus = await Bus.findById(newBusId);
      if (!bus) {
        res.status(400);
        throw new Error('Selected bus was not found');
      }
      if (!bus.assignedRoute) {
        res.status(400);
        throw new Error('This bus is not yet assigned to a route — assign it to a route before assigning a driver');
      }
      // Only when the bus changes, so drivers left sharing a bus by older data
      // can still be edited (and then moved to a free bus to fix it).
      if (String(newBusId) !== previousBus) await assertBusFree(res, bus._id, driver._id);
      driver.assignedBus = newBusId;
      // Derived from the bus, same as on creation — never chosen independently.
      driver.assignedRoute = bus.assignedRoute;
    } else {
      driver.assignedBus = null;
      driver.assignedRoute = null;
    }
    busChanged = newBusId !== previousBus;
  }

  await driver.save();

  if (busChanged) {
    if (previousBus) await Bus.findByIdAndUpdate(previousBus, { assignedDriver: null });
    if (previousRoute) await Route.findByIdAndUpdate(previousRoute, { assignedDriver: null });
    if (driver.assignedBus) {
      await Bus.findByIdAndUpdate(driver.assignedBus, { assignedDriver: driver._id });
      await Route.findByIdAndUpdate(driver.assignedRoute, { assignedDriver: driver._id });
    }
  }

  const populated = await populateDriver(Driver.findById(driver._id));
  res.json({ success: true, data: populated });
});

// @desc    Delete driver
// @route   DELETE /api/drivers/:id
export const deleteDriver = asyncHandler(async (req, res) => {
  const driver = await Driver.findById(req.params.id);
  if (!driver) {
    res.status(404);
    throw new Error('Driver not found');
  }
  await Promise.all([
    Bus.updateMany({ assignedDriver: driver._id }, { assignedDriver: null }),
    Route.updateMany({ assignedDriver: driver._id }, { assignedDriver: null }),
  ]);
  await driver.deleteOne();
  res.json({ success: true, message: 'Driver deleted' });
});

// @desc    Options list for selects (also used by Register Bus driver search)
// @route   GET /api/drivers/meta/options
export const getDriverOptions = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const filter = {};
  if (q) {
    filter.$or = [
      { firstName: { $regex: searchPattern(q), $options: 'i' } },
      { lastName: { $regex: searchPattern(q), $options: 'i' } },
      { phone: { $regex: searchPattern(q), $options: 'i' } },
      { licenseNumber: { $regex: searchPattern(q), $options: 'i' } },
    ];
  }
  const drivers = await Driver.find(filter)
    .select('firstName lastName phone licenseNumber status assignedBus')
    .sort({ createdAt: 1 })
    // Unfiltered, this is the full list the admin uses to see which buses are
    // already taken, so it must not be cut short.
    .limit(q ? 50 : 2000);
  res.json({ success: true, data: drivers });
});
