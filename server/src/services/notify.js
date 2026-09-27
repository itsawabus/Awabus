import Notification from '../models/Notification.js';
import Route from '../models/Route.js';
import Bus from '../models/Bus.js';
import { NOTIFICATION_TYPES } from './notificationTypes.js';

/**
 * Store a notification for the current school (tenant context).
 * Never throws: a notification problem must not break the action that caused it.
 * With `dedupeKey`, the same event is stored at most once per `dedupeMinutes`.
 */
export async function notify({ type, title, message = '', link = '', dedupeKey = '', dedupeMinutes = 10 }) {
  try {
    const def = NOTIFICATION_TYPES[type];
    if (!def) throw new Error(`Unknown notification type "${type}"`);
    if (dedupeKey) {
      const since = new Date(Date.now() - dedupeMinutes * 60 * 1000);
      if (await Notification.exists({ dedupeKey, createdAt: { $gte: since } })) return null;
    }
    return await Notification.create({
      type,
      category: def.category,
      severity: def.severity,
      title,
      message,
      link,
      dedupeKey,
    });
  } catch (err) {
    console.error(`[notify] could not store "${type}":`, err.message);
    return null;
  }
}

/** "Route A (Bus GR-1234-20)" style label for a trip, for notification text. */
export async function describeTrip(trip) {
  const [route, bus] = await Promise.all([
    Route.findById(trip.route).select('name').lean(),
    Bus.findById(trip.bus).select('plateNumber').lean(),
  ]);
  return {
    routeName: route?.name || 'A route',
    plate: bus?.plateNumber || '',
  };
}
