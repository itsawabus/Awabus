import asyncHandler from 'express-async-handler';
import Route from '../models/Route.js';
import Driver from '../models/Driver.js';
import Student from '../models/Student.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { nextSequentialCode } from '../utils/idGenerator.js';
import { searchPattern } from '../utils/search.js';
import { inGhana } from '../utils/geo.js';
import { cleanRouteTimes } from '../utils/sessions.js';

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
      { routeId: { $regex: searchPattern(q), $options: 'i' } },
      { name: { $regex: searchPattern(q), $options: 'i' } },
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

// Checks and tidies a list of stops: names, positions inside Ghana (with a
// margin), at most 50, numbered in the order given. Returns { stops } or { error }.
const MAX_STOPS = 50;
function cleanStops(input) {
  if (!Array.isArray(input)) return { error: 'Stops must be a list' };
  if (input.length > MAX_STOPS) return { error: `A route can have at most ${MAX_STOPS} stops` };
  const stops = [];
  for (let i = 0; i < input.length; i += 1) {
    const st = input[i] || {};
    const name = String(st.name || '').trim();
    const lat = Number(st.lat);
    const lng = Number(st.lng);
    if (name.length < 2 || name.length > 80) return { error: `Stop ${i + 1} needs a name (2-80 characters)` };
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { error: `Stop ${i + 1} needs a position` };
    if (!inGhana(lat, lng)) return { error: `Stop ${i + 1} is outside Ghana` };
    stops.push({ name, lat, lng, order: i + 1 });
  }
  return { stops };
}

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

  const cleaned = cleanStops(stops || []);
  if (cleaned.error) {
    res.status(400);
    throw new Error(cleaned.error);
  }

  const times = cleanRouteTimes(req.body);
  if (times.error) {
    res.status(400);
    throw new Error(times.error);
  }

  const routeId = await nextSequentialCode(Route, 'routeId', 'RT-', 3);

  const route = await Route.create({
    routeId,
    name,
    stops: cleaned.stops,
    morningStartTime: times.morningStartTime,
    eveningStartTime: times.eveningStartTime,
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
  if (stops !== undefined) {
    const cleaned = cleanStops(stops);
    if (cleaned.error) {
      res.status(400);
      throw new Error(cleaned.error);
    }
    route.stops = cleaned.stops;
  }
  if (status !== undefined) route.status = status;
  if (req.body.morningStartTime !== undefined || req.body.eveningStartTime !== undefined) {
    const times = cleanRouteTimes(req.body, route);
    if (times.error) {
      res.status(400);
      throw new Error(times.error);
    }
    route.morningStartTime = times.morningStartTime;
    route.eveningStartTime = times.eveningStartTime;
  }

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
    .select('routeId name status assignedBus assignedDriver morningStartTime eveningStartTime')
    .populate('assignedBus', 'plateNumber name capacity')
    .populate('assignedDriver', 'firstName lastName')
    .sort({ createdAt: 1 });
  res.json({ success: true, data: routes });
});
