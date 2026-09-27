import mongoose from 'mongoose';
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
  },
  { timestamps: true }
);

driverSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});

driverSchema.pre('save', async function preSave(next) {
  if (!this.isModified('password') || !this.password) return next();
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