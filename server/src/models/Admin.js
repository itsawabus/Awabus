import mongoose from 'mongoose';
import { setupCodeFields } from '../utils/setupCode.js';
import { normalizePhones } from '../plugins/normalizePhones.js';
import bcrypt from 'bcryptjs';
import { tenantScope } from '../plugins/tenantScope.js';

const adminSchema = new mongoose.Schema(
  {
    // Required for tenant admins; null for platform superadmins, who sit
    // above all tenants and therefore belong to no single school.
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      default: null,
      index: true,
      required: function requiredSchool() {
        return this.role !== 'superadmin';
      },
    },

    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    password: { type: String, minlength: 6 },
    role: { type: String, enum: ['admin', 'superadmin'], default: 'admin' },
    avatarUrl: { type: String, default: '' },
    // No longer filled in ("Remember this device" is handled in the browser);
    // kept so older records still load.
    rememberedDevices: [{ type: String, select: false }],
    // One-time code for choosing the first password (utils/setupCode.js).
    ...setupCodeFields,
    // When the password last changed; sign-ins from before then stop working.
    passwordChangedAt: { type: Date, default: null },
    // Notification types this admin switched off (see services/notificationTypes.js).
    mutedNotifications: [{ type: String }],
  },
  { timestamps: true }
);

adminSchema.pre('save', async function preSave(next) {
  if (!this.isModified('password') || !this.password) return next();
  // A second back so a token issued right after this save is still newer.
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

adminSchema.methods.matchPassword = function matchPassword(enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

adminSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.rememberedDevices;
  delete obj.setupCodeHash;
  delete obj.setupCodeAttempts;
  return obj;
};

adminSchema.index({ school: 1, phone: 1 }, { unique: true, sparse: true });
adminSchema.index({ school: 1, role: 1 });

adminSchema.plugin(tenantScope);

adminSchema.plugin(normalizePhones, { paths: ['phone'] });
export default mongoose.model('Admin', adminSchema);