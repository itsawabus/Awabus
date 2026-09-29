import asyncHandler from 'express-async-handler';
import Bus from '../models/Bus.js';
import Student from '../models/Student.js';
import Trip from '../models/Trip.js';
import Route from '../models/Route.js';
import { LIVE_TRIP_FILTER } from '../services/staleTrips.js';

// @desc    Dashboard summary: stat cards, bus status bar chart, recent trip logs.
// @route   GET /api/dashboard
export const getDashboard = asyncHandler(async (req, res) => {
  const [busesInService, totalBuses, maintenanceBuses, idleBuses, totalStudents, activeTrips, recentTrips] =
    await Promise.all([
      Bus.countDocuments({ status: 'Active' }),
      Bus.countDocuments(),
      Bus.countDocuments({ status: 'Maintenance' }),
      Bus.countDocuments({ status: 'Idle' }),
      Student.countDocuments(),
      Trip.countDocuments(LIVE_TRIP_FILTER), // running now, delayed ones included
      Trip.find()
        .sort({ date: -1 })
        .limit(6)
        .populate('route', 'name')
        .populate('bus', 'plateNumber'),
    ]);

  // "Today" is the calendar day in Ghana, which is on UTC all year.
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const [routeCount, completedToday] = await Promise.all([
    Route.countDocuments({ status: 'Active' }),
    Trip.countDocuments({
      status: 'Completed',
      $or: [{ endedAt: { $gte: startOfToday } }, { endedAt: null, date: { $gte: startOfToday } }],
    }),
  ]);

  res.json({
    success: true,
    data: {
      stats: {
        busesInService,
        totalBuses,
        maintenanceBuses,
        totalStudents,
        activeRouteCount: routeCount,
        activeTrips,
        completedToday,
      },
      busStatusSummary: {
        active: busesInService,
        maintenance: maintenanceBuses,
        idle: idleBuses,
      },
      recentTrips: recentTrips.map((t) => ({
        id: t._id,
        routeName: t.route?.name || '—',
        busId: t.bus?.plateNumber || '—',
        status: t.status,
        scheduledTime: t.departureTime,
      })),
    },
  });
});
