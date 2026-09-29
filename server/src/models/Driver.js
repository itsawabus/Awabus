import mongoose from 'mongoose';
import { setupCodeFields } from '../utils/setupCode.js';
import { normalizePhones } from '../plugins/normalizePhones.js';
import bcrypt from 'bcryptjs';
import { tenantScope } from '../plugins/tenantScope.js';

const assignmentHistorySchema = new mongoose.Schema(
  {
    bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus' },
    route: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
    from: Date,
    to: Date,
    status: { type: String, enum: ['Active', 'Idle', 'Ended'], default: 'Active' },
  },
  { _id: false }
);

const driverSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true }, // unique per school
    email: { type: String, trim: true, lowercase: true },
    dob: { type: Date },
    gender: { type: String, enum: ['Male', 'Female'] },
    profilePhotoUrl: { type: String, default: '' },
    password: { type: String, default: '', select: false }, // for future driver-app login

    // License information
    licenseNumber: { type: String, required: true, trim: true }, // unique per school
    licenseExpiry: { type: Date },
    licenseClass: {
      type: String,
      enum: [
        'Class B (Light Vehicle)',
        'Class D (Articulator)',
        'Class E (Motorbike)',
        'Class F (Heavy Duty / Bus)',
      ],
      default: 'Class F (Heavy Duty / Bus)',
    },
    licenseValidation: {
      status: { type: String, enum: ['pending', 'verified', 'failed'], default: 'pending' },
      message: { type: String, default: '' },
      checkedAt: Date,
    },

    // Assignment
    assignedBus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', default: null },
    assignedRoute: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', default: null },
    assignmentHistory: [assignmentHistorySchema],

    // Emergency & residential
    emergencyContactName: { type: String, trim: true },
    emergencyContactRelation: { type: String, trim: true },
    emergencyContactPhone: { type: String, trim: true },
    residentialAddress: { type: String, trim: true },

    status: { type: String, enum: ['Active', 'Idle', 'Maintenance', 'Inactive'], default: 'Active' },
    // One-time code for choosing the first password (utils/setupCode.js).
    ...setupCodeFields,
    // When the password last changed; sign-ins from before then stop working.
    passwordChangedAt: { type: Date, default: null },
    // Online / offline in the driver app: when the app last reached the server
    // (it checks in every 30 seconds while open and signed in), and when the
    // driver last signed out.
    lastSeenAt: { type: Date, default: null },
    // Driver-app notifications the driver deleted (by notification id); kept
    // 30 days, after which those notifications are gone anyway.
    dismissedNotifications: [{ id: { type: String }, at: { type: Date, default: Date.now }, _id: false }],
    signedOutAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// No check-in for this long means the app is closed, the phone is off or
// has no data: the driver shows as offline.
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

driverSchema.virtual('online').get(function online() {
  if (!this.lastSeenAt) return false;
  if (this.signedOutAt && this.signedOutAt >= this.lastSeenAt) return false;
  return Date.now() - new Date(this.lastSeenAt).getTime() < ONLINE_WINDOW_MS;
});

driverSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});

driverSchema.pre('save', async function preSave(next) {
  if (!this.isModified('password') || !this.password) return next();
  // A second back so a token issued right after this save is still newer.
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// phone/licenseNumber only need to be unique within a school, not globally
driverSchema.index({ school: 1, phone: 1 }, { unique: true });
driverSchema.index({ school: 1, licenseNumber: 1 }, { unique: true });
driverSchema.index({ school: 1, status: 1 });
// Database-level guard: no two drivers can hold the same bus at once.
driverSchema.index(
  { assignedBus: 1 },
  { unique: true, partialFilterExpression: { assignedBus: { $type: 'objectId' } } }
);

driverSchema.set('toJSON', { virtuals: true });
driverSchema.set('toObject', { virtuals: true });

driverSchema.plugin(tenantScope);

driverSchema.plugin(normalizePhones, { paths: ['phone', 'emergencyContactPhone'] });
export default mongoose.model('Driver', driverSchema);