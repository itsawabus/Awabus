import mongoose from 'mongoose';
import { tenantScope } from '../plugins/tenantScope.js';

// How long a notification is kept before MongoDB removes it on its own.
export const NOTIFICATION_TTL_DAYS = 30;

const notificationSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },

    type: { type: String, required: true }, // a key of NOTIFICATION_TYPES
    category: { type: String, enum: ['critical', 'trips', 'fleet', 'account'], required: true },
    severity: { type: String, enum: ['critical', 'warning', 'info'], default: 'info' },
    title: { type: String, required: true, trim: true },
    message: { type: String, default: '', trim: true },
    link: { type: String, default: '' }, // admin-site path to open, e.g. /trip-history/<id>
    // Same key within a short window = the same event, so it is only stored once.
    dedupeKey: { type: String, default: '' },
    // Admins of the school who have read it (read state is per person).
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }],
    // Admins who deleted it: it disappears for them only, since other admins
    // of the school share the same notification.
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }],
  },
  { timestamps: true }
);

notificationSchema.index({ school: 1, createdAt: -1 });
notificationSchema.index({ school: 1, dedupeKey: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NOTIFICATION_TTL_DAYS * 24 * 60 * 60 });

notificationSchema.plugin(tenantScope);

export default mongoose.model('Notification', notificationSchema);
