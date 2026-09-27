import asyncHandler from 'express-async-handler';
import Bus from '../models/Bus.js';
import Driver from '../models/Driver.js';
import Route from '../models/Route.js';
import Student from '../models/Student.js';
import Trip from '../models/Trip.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { assertFormats, ifChanged, normalizeCode } from '../utils/formats.js';
import { notify } from '../services/notify.js';

const populateBus = (query) =>
  query
    .populate('assignedRoute', 'routeId name')
    .populate('assignedDriver', 'firstName lastName phone');

// Buses must belong to a route (enforced at creation — see createBus), so the
// admin's Add Driver screen can show the real route a bus already services
// instead of asking the admin to pick one separately.
const populateBusOptions = (query) =>
  query
    .populate('assignedRoute', 'routeId name stops students')
    .populate('assignedDriver', 'firstName lastName');

// @desc    List buses (search + status filter + pagination) + fleet stats
// @route   GET /api/buses
export const getBuses = asyncHandler(async (req, res) => {
  const { q, status } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (status && status !== 'All') filter.status = status;
  if (q) {
    filter.$or = [
      { plateNumber: { $regex: q, $options: 'i' } },
      { name: { $regex: q, $options: 'i' } },
    ];
  }

  const [buses, total, totalBuses, maintenance, idle] = await Promise.all([
    populateBus(Bus.find(filter)).sort({ createdAt: 1 }).skip(skip).limit(limit),
    Bus.countDocuments(filter),
    Bus.countDocuments(),
    Bus.countDocuments({ status: 'Maintenance' }),
    Bus.countDocuments({ status: 'Idle' }),
  ]);

  // Attach seats filled (student count) per bus for the capacity column.
  const busIds = buses.map((b) => b._id);
  const counts = await Student.aggregate([
    { $match: { bus: { $in: busIds } } },
    { $group: { _id: '$bus', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  const data = buses.map((b) => {
    const obj = b.toObject();
    obj.seatsFilled = countMap.get(String(b._id)) || 0;
    return obj;
  });

  res.json({
    success: true,
    data,
    meta: buildPaginationMeta(total, page, limit),
    stats: { totalBuses, maintenance, idle },
  });
});

// @desc    Get bus profile (specs + recent trips)
// @route   GET /api/buses/:id
export const getBusById = asyncHandler(async (req, res) => {
  const bus = await populateBus(Bus.findById(req.params.id));
  if (!bus) {
    res.status(404);
    throw new Error('Bus not found');
  }
  const recentTrips = await Trip.find({ bus: bus._id })
    .populate('route', 'routeId name')
    .sort({ date: -1 })
    .limit(10);
  res.json({ success: true, data: bus, recentTrips });
});

// @desc    Register a new bus
// @route   POST /api/buses
export const createBus = asyncHandler(async (req, res) => {
  const { plateNumber, name, type, capacity, assignedRoute, status } = req.body;
  if (!plateNumber || !name || !capacity) {
    res.status(400);
    throw new Error('Plate number, name and capacity are required');
  }
  assertFormats(res, { plateNumber, capacity });
  if (!assignedRoute) {
    res.status(400);
    throw new Error('A bus must be assigned to a route — create a route first if none exist yet');
  }

  const route = await Route.findById(assignedRoute);
  if (!route) {
    res.status(400);
    throw new Error('Selected route was not found');
  }
  if (route.assignedBus) {
    res.status(400);
    throw new Error('This route already has a bus assigned — reassign that bus before adding another');
  }

  const bus = await Bus.create({
    plateNumber: normalizeCode(plateNumber),
    name,
    type: type || 'Standard',
    capacity,
    assignedRoute,
    status: status || 'Idle',
  });

  await Route.findByIdAndUpdate(assignedRoute, { assignedBus: bus._id });
  // Backfill: students already on this route (added before it had a bus)
  // now derive their bus from it, same as at student-creation time.
  await Student.updateMany({ route: assignedRoute }, { bus: bus._id });

  const populated = await populateBus(Bus.findById(bus._id));
  res.status(201).json({ success: true, data: populated });
});

// @desc    Update bus
// @route   PUT /api/buses/:id
export const updateBus = asyncHandler(async (req, res) => {
  const bus = await Bus.findById(req.params.id);
  if (!bus) {
    res.status(404);
    throw new Error('Bus not found');
  }

  // Only new or changed values are checked (see ifChanged).
  assertFormats(res, {
    plateNumber: ifChanged(req.body.plateNumber, bus.plateNumber),
    capacity: ifChanged(req.body.capacity, bus.capacity),
  });
  const previousStatus = bus.status;
  const fields = ['plateNumber', 'name', 'type', 'capacity', 'status'];
  if (req.body.plateNumber !== undefined) req.body.plateNumber = normalizeCode(req.body.plateNumber);
  fields.forEach((f) => {
    if (req.body[f] !== undefined) bus[f] = req.body[f];
  });

  const previousRoute = bus.assignedRoute ? String(bus.assignedRoute) : null;
  let routeChanged = false;

  if (req.body.assignedRoute !== undefined) {
    if (!req.body.assignedRoute) {
      res.status(400);
      throw new Error('A bus must remain assigned to a route');
    }
    const route = await Route.findById(req.body.assignedRoute);
    if (!route) {
      res.status(400);
      throw new Error('Selected route was not found');
    }
    routeChanged = String(req.body.assignedRoute) !== previousRoute;
    if (routeChanged && route.assignedBus && String(route.assignedBus) !== String(bus._id)) {
      res.status(400);
      throw new Error('This route already has a bus assigned — reassign that bus before adding another');
    }
    bus.assignedRoute = req.body.assignedRoute;
  }

  await bus.save();

  if (routeChanged) {
    if (previousRoute) {
      // The driver (if any) moves with the bus to the new route below, so
      // the old route's assignedDriver clears with its assignedBus.
      await Route.findByIdAndUpdate(previousRoute, { assignedBus: null, assignedDriver: null });
      await Student.updateMany({ route: previousRoute }, { bus: null });
    }
    await Route.findByIdAndUpdate(bus.assignedRoute, { assignedBus: bus._id });
    await Student.updateMany({ route: bus.assignedRoute }, { bus: bus._id });
    // The bus's currently assigned driver (if any) derives their route from
    // this bus, so keep that in sync when the bus moves to a different route.
    if (bus.assignedDriver) {
      await Driver.findByIdAndUpdate(bus.assignedDriver, { assignedRoute: bus.assignedRoute });
      await Route.findByIdAndUpdate(bus.assignedRoute, { assignedDriver: bus.assignedDriver });
    }
  }

  if (previousStatus !== bus.status && [previousStatus, bus.status].includes('Maintenance')) {
    const into = bus.status === 'Maintenance';
    await notify({
      type: 'bus_status',
      title: into ? `${bus.plateNumber} is in maintenance` : `${bus.plateNumber} is back in service`,
      message: into
        ? `${bus.name} was taken off the road by ${req.admin.name}. Its route has no working bus until it returns.`
        : `${bus.name} was set to ${bus.status} by ${req.admin.name}.`,
      link: `/buses/${bus._id}`,
      dedupeKey: `bus_status:${bus._id}:${bus.status}`,
      dedupeMinutes: 1,
    });
  }

  const populated = await populateBus(Bus.findById(bus._id));
  res.json({ success: true, data: populated });
});

// @desc    Delete bus
// @route   DELETE /api/buses/:id
export const deleteBus = asyncHandler(async (req, res) => {
  const bus = await Bus.findById(req.params.id);
  if (!bus) {
    res.status(404);
    throw new Error('Bus not found');
  }
  await Promise.all([
    // A route's assignedDriver is only ever the driver of its bus, so both
    // clear together when that bus goes away.
    Route.updateMany({ assignedBus: bus._id }, { assignedBus: null, assignedDriver: null }),
    // A driver's assignedRoute is derived from their bus, so clear both.
    Driver.updateMany({ assignedBus: bus._id }, { assignedBus: null, assignedRoute: null }),
    Student.updateMany({ bus: bus._id }, { bus: null }),
  ]);
  await bus.deleteOne();
  res.json({ success: true, message: 'Bus deleted' });
});

// @desc    Options list for selects
// @route   GET /api/buses/meta/options
export const getBusOptions = asyncHandler(async (req, res) => {
  const buses = await populateBusOptions(
    Bus.find().select('plateNumber name capacity status assignedRoute assignedDriver').sort({ createdAt: 1 })
  );
  res.json({ success: true, data: buses });
});
