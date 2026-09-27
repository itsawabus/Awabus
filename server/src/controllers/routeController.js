import asyncHandler from 'express-async-handler';
import Route from '../models/Route.js';
import Driver from '../models/Driver.js';
import Student from '../models/Student.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { nextSequentialCode } from '../utils/idGenerator.js';

const populateRoute = (query) =>
  query
    .populate('assignedDriver', 'firstName lastName phone')
    .populate('assignedBus', 'plateNumber name capacity')
    .populate('students', 'firstName lastName studentCode');

// @desc    List routes (search + status filter + pagination)
// @route   GET /api/routes
export const getRoutes = asyncHandler(async (req, res) => {
  const { q, status } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (status) filter.status = status;
  if (q) {
    filter.$or = [
      { routeId: { $regex: q, $options: 'i' } },
      { name: { $regex: q, $options: 'i' } },
    ];
  }

  const [routes, total, totalRoutes, active, withoutBus, studentsOnRoutes] = await Promise.all([
    populateRoute(Route.find(filter)).sort({ createdAt: 1 }).skip(skip).limit(limit),
    Route.countDocuments(filter),
    Route.countDocuments(),
    Route.countDocuments({ status: 'Active' }),
    Route.countDocuments({ assignedBus: null }),
    Student.countDocuments({ route: { $ne: null } }),
  ]);

  res.json({
    success: true,
    data: routes,
    meta: buildPaginationMeta(total, page, limit),
    stats: { totalRoutes, active, withoutBus, studentsOnRoutes },
  });
});

// @desc    Get single route
// @route   GET /api/routes/:id
export const getRouteById = asyncHandler(async (req, res) => {
  const route = await populateRoute(Route.findById(req.params.id));
  if (!route) {
    res.status(404);
    throw new Error('Route not found');
  }
  res.json({ success: true, data: route });
});

// @desc    Create route
// @route   POST /api/routes
export const createRoute = asyncHandler(async (req, res) => {
  // Routes are the root of the assignment chain (bus -> route, driver -> bus,
  // student -> route), so a route never takes a bus/driver/students at
  // creation — those are always assigned from that entity's own side, never
  // the other way around, so this side of the relationship can't drift out
  // of sync with the derivation logic in busController/driverController/
  // studentController.
  const { name, stops, status } = req.body;
  if (!name) {
    res.status(400);
    throw new Error('Route name is required');
  }

  const routeId = await nextSequentialCode(Route, 'routeId', 'RT-', 3);

  const route = await Route.create({
    routeId,
    name,
    stops: stops || [],
    status: status || 'Active',
  });

  const populated = await populateRoute(Route.findById(route._id));
  res.status(201).json({ success: true, data: populated });
});

// @desc    Update route
// @route   PUT /api/routes/:id
export const updateRoute = asyncHandler(async (req, res) => {
  const route = await Route.findById(req.params.id);
  if (!route) {
    res.status(404);
    throw new Error('Route not found');
  }

  const { name, stops, status } = req.body;
  if (name !== undefined) route.name = name;
  if (stops !== undefined) route.stops = stops;
  if (status !== undefined) route.status = status;

  await route.save();

  const populated = await populateRoute(Route.findById(route._id));
  res.json({ success: true, data: populated });
});

// @desc    Delete route
// @route   DELETE /api/routes/:id
export const deleteRoute = asyncHandler(async (req, res) => {
  const route = await Route.findById(req.params.id);
  if (!route) {
    res.status(404);
    throw new Error('Route not found');
  }
  // A bus must always belong to a route (enforced at bus creation) — deleting
  // a route out from under an assigned bus would leave that bus, and its
  // driver's derived route, in a state the rest of the system assumes can't
  // happen. Reassigning/deleting the bus first keeps that invariant intact.
  if (route.assignedBus) {
    res.status(400);
    throw new Error('This route still has a bus assigned to it — reassign or delete the bus first.');
  }
  await Promise.all([
    Driver.updateMany({ assignedRoute: route._id }, { assignedRoute: null }),
    Student.updateMany({ route: route._id }, { route: null, bus: null }),
  ]);
  await route.deleteOne();
  res.json({ success: true, message: 'Route deleted' });
});

// @desc    Lightweight options list for selects (id + name + status)
// @route   GET /api/routes/meta/options
export const getRouteOptions = asyncHandler(async (req, res) => {
  const routes = await Route.find()
    .select('routeId name status assignedBus assignedDriver')
    .populate('assignedBus', 'plateNumber name capacity')
    .populate('assignedDriver', 'firstName lastName')
    .sort({ createdAt: 1 });
  res.json({ success: true, data: routes });
});
