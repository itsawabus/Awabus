import mongoose from 'mongoose';

// A crash of the driver app, sent by the phone on its next launch
// (driver/src/lib/crashLog.js), for the superadmin System page. Kept 30 days.
const appCrashSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },
    message: { type: String, default: '' },
    stack: { type: String, default: '' },
    native: { type: Boolean, default: false }, // Android crash (not a JavaScript error)
    code: { type: String, default: '' }, // app version line, e.g. "2026-09-29 · crash-safe start"
    happenedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

appCrashSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model('AppCrash', appCrashSchema);
