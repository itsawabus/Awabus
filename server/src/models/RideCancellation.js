import mongoose from 'mongoose';
import { tenantScope } from '../plugins/tenantScope.js';

// A parent (by phone, through the AwaBus line) or the school office cancelled
// one run for a student: the morning pick-up or the afternoon drop-off on a
// given day. That day's trip lists the student as "Cancelled" and no arrival
// call is made for them.
const rideCancellationSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    date: { type: String, required: true }, // school day, YYYY-MM-DD
    session: { type: String, enum: ['morning', 'evening'], required: true },
    source: { type: String, enum: ['phone', 'office'], default: 'office' },
    guardian: { type: mongoose.Schema.Types.ObjectId, ref: 'Guardian', default: null }, // the caller, for phone cancellations
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }, // for office cancellations
  },
  { timestamps: true }
);

rideCancellationSchema.index({ school: 1, student: 1, date: 1, session: 1 }, { unique: true });
rideCancellationSchema.index({ school: 1, date: 1, session: 1 });
// Old cancellations are no longer needed once the day has long passed.
rideCancellationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

rideCancellationSchema.plugin(tenantScope);

export default mongoose.model('RideCancellation', rideCancellationSchema);
