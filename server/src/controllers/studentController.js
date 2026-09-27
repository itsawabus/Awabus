import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import { normalizeGhanaPhone } from '../utils/phone.js';
import Student from '../models/Student.js';
import Guardian from '../models/Guardian.js';
import Route from '../models/Route.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { nextYearCode } from '../utils/idGenerator.js';
import { assertFormats, ifChanged } from '../utils/formats.js';
import Trip from '../models/Trip.js';

const populateStudent = (query) =>
  query
    .populate('primaryGuardian')
    .populate('route', 'routeId name')
    .populate({
      path: 'bus',
      select: 'plateNumber name assignedDriver',
      populate: { path: 'assignedDriver', select: 'firstName lastName' },
    });

// Home location fields shared by every student in a household.
const LOCATION_FIELDS = ['homeAddress', 'geofenceRadius', 'lat', 'lng'];

const pickLocation = (doc) => Object.fromEntries(LOCATION_FIELDS.map((f) => [f, doc[f]]));

// Loads the student whose home location is being shared, giving it a household
// id first if it doesn't have one yet.
async function getLinkSource(sourceId, res, selfId) {
  if (!mongoose.isValidObjectId(sourceId) || (selfId && String(sourceId) === String(selfId))) {
    res.status(400);
    throw new Error('Choose another student to share the home location with');
  }
  const source = await Student.findById(sourceId);
  if (!source) {
    res.status(400);
    throw new Error('The student to share the home location with was not found');
  }
  if (!source.household) {
    source.household = new mongoose.Types.ObjectId();
    await Student.updateOne({ _id: source._id }, { household: source.household });
  }
  return source;
}

// A household with a single member left is no longer shared.
async function tidyHousehold(householdId) {
  if (!householdId) return;
  const remaining = await Student.find({ household: householdId }).select('_id').limit(2);
  if (remaining.length === 1) await Student.updateOne({ _id: remaining[0]._id }, { household: null });
}

const getHouseholdMembers = (student) =>
  student.household
    ? Student.find({ household: student.household, _id: { $ne: student._id } })
        .select('firstName lastName studentCode classGrade')
        .sort({ createdAt: 1 })
    : [];

// Today's status for each student, read from today's trips (the driver app's
// roll call and boarding scans are saved on the trip, not on the student).
// Uses the same day boundaries as the driver app's "today's trip".
function statusFromProgress(trip, p) {
  if (trip.status === 'Cancelled' || p.attendance === 'Cancelled') return 'Trip cancelled';
  if (p.attendance === 'Absent') return 'Absent';
  if (p.dropoffStatus === 'Dropped off') return 'Dropped off';
  if (p.dropoffStatus === 'On board' || p.dropoffStatus === 'Boarding now') return 'On board';
  if (p.dropoffStatus === 'Not on board') return 'Not on board';
  // The driver app lists everyone as Present until marked otherwise, so before
  // the trip starts that isn't news yet.
  if (trip.status === 'Scheduled') return 'Trip not started';
  if (trip.status === 'Completed') return 'Not scanned';
  return 'Awaiting pickup';
}

async function todayStatuses(students) {
  const statuses = new Map(students.map((st) => [String(st._id), 'No trip today']));
  if (!students.length) return statuses;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const routeIds = [...new Set(students.map((st) => String(st.route?._id || st.route || '')).filter(Boolean))];
  const trips = await Trip.find({ date: { $gte: start, $lte: end }, route: { $in: routeIds } })
    .select('route status studentProgress startedAt createdAt')
    .lean();
  // A trip in progress wins; otherwise the latest trip of the day (e.g. the
  // afternoon drop-off after the morning pickup). Later entries overwrite earlier ones.
  const live = (t) => (t.status === 'In Progress' ? 1 : 0);
  trips.sort((a, b) => live(a) - live(b) || new Date(a.startedAt || a.createdAt) - new Date(b.startedAt || b.createdAt));
  for (const trip of trips) {
    const onTrip = new Map((trip.studentProgress || []).map((p) => [String(p.student), p]));
    for (const st of students) {
      if (String(st.route?._id || st.route) !== String(trip.route)) continue;
      const p = onTrip.get(String(st._id));
      statuses.set(String(st._id), p ? statusFromProgress(trip, p) : trip.status === 'Scheduled' ? 'Trip not started' : 'Not on this trip');
    }
  }
  return statuses;
}

// @desc    List students (search + pagination) + directory stats
// @route   GET /api/students
export const getStudents = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const { page, limit, skip } = getPagination(req.query, 8);

  const filter = {};
  if (q) {
    filter.$or = [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { studentCode: { $regex: q, $options: 'i' } },
    ];
  }

  const [students, total, totalStudents, male, female, guardianCount] = await Promise.all([
    populateStudent(Student.find(filter)).sort({ createdAt: 1 }).skip(skip).limit(limit),
    Student.countDocuments(filter),
    Student.countDocuments(),
    Student.countDocuments({ gender: 'Male' }),
    Student.countDocuments({ gender: 'Female' }),
    Guardian.countDocuments(),
  ]);

  const today = await todayStatuses(students);
  res.json({
    success: true,
    data: students.map((st) => ({ ...st.toJSON(), todayStatus: today.get(String(st._id)) })),
    meta: buildPaginationMeta(total, page, limit),
    stats: { totalStudents, male, female, guardianCount },
  });
});

// @desc    Get student profile
// @route   GET /api/students/:id
export const getStudentById = asyncHandler(async (req, res) => {
  const student = await populateStudent(Student.findById(req.params.id));
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  const [householdMembers, today] = await Promise.all([getHouseholdMembers(student), todayStatuses([student])]);
  res.json({ success: true, data: { ...student.toJSON(), householdMembers, todayStatus: today.get(String(student._id)) } });
});

// @desc    Create student (final step of Add Student wizard)
// @route   POST /api/students
export const createStudent = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    dob,
    gender,
    classGrade,
    profilePhotoUrl,
    guardian, // { id? , firstName, lastName, relation, phone, email }
    secondContactName,
    secondContactPhone,
    emergencyInstructions,
    route,
    pickupPoint,
    dropoffPoint,
    pickupTime,
    dropoffTime,
    homeAddress,
    geofenceRadius,
    lat,
    lng,
    linkLocationWith, // id of a sibling/neighbour whose home location this student shares
  } = req.body;

  if (!firstName || !lastName) {
    res.status(400);
    throw new Error('First name and last name are required');
  }
  if (!route) {
    res.status(400);
    throw new Error('A student must be assigned to a route — create a route first if none exist yet');
  }
  if (!linkLocationWith) assertFormats(res, { lat, lng, geofenceRadius });
  assertFormats(res, { studentDob: dob, email: guardian?.email });

  const routeDoc = await Route.findById(route);
  if (!routeDoc) {
    res.status(400);
    throw new Error('Selected route was not found');
  }
  // The student's bus follows whichever bus currently services this route
  // (may be null if a bus hasn't been assigned to the route yet) — never
  // chosen independently, so it can't drift out of sync with the route.
  const bus = routeDoc.assignedBus || null;

  let location = { homeAddress, geofenceRadius, lat, lng };
  let household = null;
  if (linkLocationWith) {
    const source = await getLinkSource(linkLocationWith, res);
    location = pickLocation(source);
    household = source.household;
  }

  let guardianId = guardian?.id || null;
  if (!guardianId && guardian?.phone) {
    const created = await Guardian.create({
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      relation: guardian.relation || 'Guardian',
      phone: guardian.phone,
      email: guardian.email,
    });
    guardianId = created._id;
  }

  const studentCode = await nextYearCode(Student, 'studentCode', 'ST', new Date().getFullYear(), 3);

  const student = await Student.create({
    studentCode,
    firstName,
    lastName,
    dob,
    gender,
    classGrade,
    profilePhotoUrl,
    primaryGuardian: guardianId,
    secondContactName,
    secondContactPhone,
    emergencyInstructions,
    route: route || null,
    bus: bus || null,
    pickupPoint,
    dropoffPoint,
    pickupTime,
    dropoffTime,
    ...location,
    household,
  });

  if (route) await Route.findByIdAndUpdate(route, { $addToSet: { students: student._id } });

  const populated = await populateStudent(Student.findById(student._id));
  res.status(201).json({ success: true, data: populated });
});

// @desc    Update student (also used by the geofence-picker Edit Student screen)
// @route   PUT /api/students/:id
export const updateStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }

  const fields = [
    'firstName',
    'lastName',
    'dob',
    'gender',
    'classGrade',
    'profilePhotoUrl',
    'secondContactName',
    'secondContactPhone',
    'emergencyInstructions',
    'pickupPoint',
    'dropoffPoint',
    'pickupTime',
    'dropoffTime',
    'homeAddress',
    'geofenceRadius',
    'lat',
    'lng',
    'status',
  ];
  // Only new or changed values are checked (see ifChanged).
  assertFormats(res, {
    studentDob: ifChanged(req.body.dob, student.dob),
    lat: ifChanged(req.body.lat, student.lat),
    lng: ifChanged(req.body.lng, student.lng),
    geofenceRadius: ifChanged(req.body.geofenceRadius, student.geofenceRadius),
    email: req.body.guardian?.email,
  });
  const locationBefore = JSON.stringify(pickLocation(student));
  const householdBefore = student.household;

  fields.forEach((f) => {
    if (req.body[f] !== undefined) student[f] = req.body[f];
  });

  // Household (shared home location) changes. Linking copies the other
  // student's location; unlinking keeps the current location but stops sharing.
  if (req.body.unlinkLocation) {
    student.household = null;
  } else if (req.body.linkLocationWith) {
    const source = await getLinkSource(req.body.linkLocationWith, res, student._id);
    Object.assign(student, pickLocation(source));
    student.household = source.household;
  }

  if (req.body.route !== undefined) {
    if (!req.body.route) {
      res.status(400);
      throw new Error('A student must remain assigned to a route');
    }
    const routeDoc = await Route.findById(req.body.route);
    if (!routeDoc) {
      res.status(400);
      throw new Error('Selected route was not found');
    }
    if (student.route && String(student.route) !== String(req.body.route)) {
      await Route.findByIdAndUpdate(student.route, { $pull: { students: student._id } });
    }
    student.route = req.body.route;
    // Derived from the route, same as on creation — never chosen independently.
    student.bus = routeDoc.assignedBus || null;
    await Route.findByIdAndUpdate(req.body.route, { $addToSet: { students: student._id } });
  }

  if (req.body.guardian) {
    const g = req.body.guardian;
    if (g.id) {
      await Guardian.findByIdAndUpdate(g.id, {
        firstName: g.firstName,
        lastName: g.lastName,
        phone: normalizeGhanaPhone(g.phone),
        email: g.email,
      });
      student.primaryGuardian = g.id;
    } else if (g.phone) {
      const created = await Guardian.create({
        firstName: g.firstName,
        lastName: g.lastName,
        relation: g.relation || 'Guardian',
        phone: g.phone,
        email: g.email,
      });
      student.primaryGuardian = created._id;
    }
  }

  await student.save();

  if (student.household && JSON.stringify(pickLocation(student)) !== locationBefore) {
    await Student.updateMany(
      { household: student.household, _id: { $ne: student._id } },
      { $set: pickLocation(student) }
    );
  }
  if (householdBefore && String(householdBefore) !== String(student.household)) await tidyHousehold(householdBefore);

  const populated = await populateStudent(Student.findById(student._id));
  const householdMembers = await getHouseholdMembers(populated);
  res.json({ success: true, data: { ...populated.toJSON(), householdMembers } });
});

// @desc    Delete student
// @route   DELETE /api/students/:id
export const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  if (student.route) await Route.findByIdAndUpdate(student.route, { $pull: { students: student._id } });
  await student.deleteOne();
  await tidyHousehold(student.household);
  res.json({ success: true, message: 'Student deleted' });
});

// @desc    Options list for selects / route builder multi-select search
// @route   GET /api/students/meta/options
export const getStudentOptions = asyncHandler(async (req, res) => {
  const { q, guardian, exclude } = req.query;
  const filter = {};
  if (guardian && mongoose.isValidObjectId(guardian)) filter.primaryGuardian = guardian;
  if (exclude && mongoose.isValidObjectId(exclude)) filter._id = { $ne: exclude };
  if (q) {
    filter.$or = [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { studentCode: { $regex: q, $options: 'i' } },
    ];
  }
  const students = await Student.find(filter)
    .select('firstName lastName studentCode classGrade route primaryGuardian household homeAddress geofenceRadius lat lng')
    .sort({ createdAt: 1 })
    .limit(50);
  res.json({ success: true, data: students });
});
