import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import School from '../models/School.js';
import Admin from '../models/Admin.js';
import Student from '../models/Student.js';
import Bus from '../models/Bus.js';
import Driver from '../models/Driver.js';
import RouteModel from '../models/Route.js';
import Trip from '../models/Trip.js';
import { tenantContext } from '../utils/tenantContext.js';
import { assertFormats } from '../utils/formats.js';

// Derives a short, URL/login-screen-friendly code from the school name,
// e.g. "Awabus Demo School" -> "AWABUS-DEMO-SCHOOL". Matches School.code's
// `uppercase: true` schema constraint.
const codeify = (name) =>
  name
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

// Superadmin endpoints intentionally operate across all tenants, so every
// query here runs via runAsSystem. This is the deliberate cross-tenant path.
const asSystem = (fn) => tenantContext.runAsSystem(fn);

// @desc    Platform-wide analytics
// @route   GET /api/superadmin/analytics
// @access  Private (superadmin)
export const getAnalytics = asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [totalSchools, activeSchools, totalAdmins, totalStudents, totalBuses, totalDrivers, totalRoutes, activeTrips, tripsToday] =
    await asSystem(() =>
      Promise.all([
        School.countDocuments({}),
        School.countDocuments({ status: 'Active' }),
        Admin.countDocuments({ role: 'admin' }),
        Student.countDocuments({}),
        Bus.countDocuments({}),
        Driver.countDocuments({}),
        RouteModel.countDocuments({}),
        Trip.countDocuments({ status: 'In Progress' }),
        Trip.countDocuments({ date: { $gte: startOfDay } }),
      ])
    );

  // Per-school breakdown for the table on the dashboard
  const schools = await asSystem(() => School.find({}).sort({ createdAt: -1 }).lean());

  const breakdown = await asSystem(() =>
    Promise.all(
      schools.map(async (school) => {
        const [students, buses, drivers, admins] = await Promise.all([
          Student.countDocuments({ school: school._id }),
          Bus.countDocuments({ school: school._id }),
          Driver.countDocuments({ school: school._id }),
          Admin.countDocuments({ school: school._id }),
        ]);
        return {
          id: school._id,
          name: school.name,
          code: school.code,
          status: school.status,
          createdAt: school.createdAt,
          students,
          buses,
          drivers,
          admins,
        };
      })
    )
  );

  res.json({
    success: true,
    stats: {
      totalSchools,
      activeSchools,
      totalAdmins,
      totalStudents,
      totalBuses,
      totalDrivers,
      totalRoutes,
      activeTrips,
      tripsToday,
    },
    schools: breakdown,
  });
});

// @desc    List all schools
// @route   GET /api/superadmin/schools
// @access  Private (superadmin)
export const listSchools = asyncHandler(async (req, res) => {
  const schools = await asSystem(() => School.find({}).sort({ createdAt: -1 }).lean());
  res.json({ success: true, schools });
});

// @desc    Create a school together with its first admin
// @route   POST /api/superadmin/schools
// @access  Private (superadmin)
export const createSchool = asyncHandler(async (req, res) => {
  const { schoolName, adminName, adminEmail, adminPhone } = req.body;

  if (!schoolName || !adminName || !adminEmail || !adminPhone) {
    res.status(400);
    throw new Error('School name, admin name, admin email and admin phone are required');
  }

  const email = adminEmail.toLowerCase().trim();
  assertFormats(res, { email });

  const existingAdmin = await asSystem(() => Admin.findOne({ email }));
  if (existingAdmin) {
    res.status(409);
    throw new Error('An account with that email already exists');
  }

  let code = codeify(schoolName);
  const codeTaken = await asSystem(() => School.findOne({ code }));
  if (codeTaken) code = `${code}-${Date.now().toString().slice(-4)}`;

  const session = await mongoose.startSession();
  let school;
  let admin;

  try {
    await session.withTransaction(async () => {
      [school] = await asSystem(() =>
        School.create([{ name: schoolName.trim(), code, contactEmail: email, contactPhone: adminPhone.trim() }], {
          session,
        })
      );

      // No password is set here on purpose: the admin sets their own on first
      // sign-in via the existing check-email / set-password flow.
      [admin] = await asSystem(() =>
        Admin.create(
          [
            {
              school: school._id,
              name: adminName.trim(),
              email,
              phone: adminPhone.trim(),
              role: 'admin',
            },
          ],
          { session }
        )
      );
    });
  } finally {
    await session.endSession();
  }

  res.status(201).json({
    success: true,
    school,
    admin: admin.toSafeObject(),
  });
});

// @desc    Toggle a school's active status
// @route   PATCH /api/superadmin/schools/:id/status
// @access  Private (superadmin)
export const updateSchoolStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['Active', 'Suspended'].includes(status)) {
    res.status(400);
    throw new Error('Status must be Active or Suspended');
  }

  const school = await asSystem(() =>
    School.findByIdAndUpdate(req.params.id, { status }, { new: true })
  );

  if (!school) {
    res.status(404);
    throw new Error('School not found');
  }

  res.json({ success: true, school });
});