import asyncHandler from 'express-async-handler';
import Trip from '../models/Trip.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';

const populateTrip = (query) =>
  query
    .populate('route', 'routeId name')
    .populate('bus', 'plateNumber name')
    .populate('driver', 'firstName lastName phone');

// @desc    List trips (search + filters + pagination) + summary stats
// @route   GET /api/trips
export const getTrips = asyncHandler(async (req, res) => {
  const { q, status, driver, bus, date } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (q) filter.tripCode = { $regex: q, $options: 'i' };
  if (status && status !== 'All') filter.status = status;
  if (driver && driver !== 'All') filter.driver = driver;
  if (bus && bus !== 'All') filter.bus = bus;
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    filter.date = { $gte: start, $lte: end };
  }

  const [trips, total, totalTrips, completed, active, delayed] = await Promise.all([
    populateTrip(Trip.find(filter)).sort({ date: -1 }).skip(skip).limit(limit),
    Trip.countDocuments(filter),
    Trip.countDocuments(),
    Trip.countDocuments({ status: 'Completed' }),
    Trip.countDocuments({ status: 'In Progress' }),
    Trip.countDocuments({ status: 'Delayed' }),
  ]);

  res.json({
    success: true,
    data: trips,
    meta: buildPaginationMeta(total, page, limit),
    stats: { totalTrips, completed, active, delayed },
  });
});

// @desc    Get trip details (stops, timeline, student progress)
// @route   GET /api/trips/:id
export const getTripById = asyncHandler(async (req, res) => {
  const trip = await populateTrip(
    Trip.findById(req.params.id).populate('studentProgress.student', 'firstName lastName studentCode')
  );
  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }
  res.json({ success: true, data: trip });
});
