import Trip from '../models/Trip.js';
import { tenantContext } from '../utils/tenantContext.js';

// Scans used to record "Alert sent" although no text was ever sent to parents.
// Rewrite that label on old trips so the history does not claim otherwise.
// Safe on every start: once rewritten, nothing matches.
export const OLD_LABEL = 'Alert sent';
export const NEW_LABEL = 'Not sent (alerts were not built yet)';

export async function fixAlertLabels() {
  return tenantContext.runAsSystem(async () => {
    const trips = await Trip.collection.find({ 'studentProgress.alertStatus': OLD_LABEL }).project({ studentProgress: 1 }).toArray();
    for (const t of trips) {
      const rows = t.studentProgress.map((p) => (p.alertStatus === OLD_LABEL ? { ...p, alertStatus: NEW_LABEL } : p));
      // eslint-disable-next-line no-await-in-loop
      await Trip.collection.updateOne({ _id: t._id }, { $set: { studentProgress: rows } });
    }
    if (trips.length) console.log(`[migrate] corrected the alert label on ${trips.length} old trip(s)`);
    return trips.length;
  });
}

export default fixAlertLabels;
