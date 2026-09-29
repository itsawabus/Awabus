import mongoose from 'mongoose';

const otpTokenSchema = new mongoose.Schema(
  {
    // Driver password-reset codes are keyed by phone; admin reset codes by the
    // email in `target`. Account-change codes belong to a signed-in admin and
    // record where the code was sent (target) and, for email/phone changes,
    // the value that becomes active once verified.
    phone: { type: String, trim: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    target: { type: String, trim: true },
    newValue: { type: String, trim: true },
    code: { type: String, required: true },
    purpose: {
      type: String,
      enum: ['password_reset', 'driver_password_reset', 'change_email', 'change_phone', 'change_password', 'reveal_password'],
      default: 'password_reset',
    },
    expiresAt: { type: Date, required: true },
    consumed: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

otpTokenSchema.index({ phone: 1, purpose: 1 });
otpTokenSchema.index({ admin: 1, purpose: 1 });
otpTokenSchema.index({ target: 1, purpose: 1 });

export default mongoose.model('OtpToken', otpTokenSchema);
