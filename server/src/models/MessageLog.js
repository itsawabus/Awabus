import mongoose from 'mongoose';

// Every SMS/email the platform tries to send, for the developers' System page.
// Deliberately NOT tenant-scoped: some messages (e.g. a driver's password
// reset code) go out before anyone is signed in. Only superadmin routes read it.
// Message bodies are stored with one-time codes hidden.
const messageLogSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ['sms', 'email'], required: true },
    purpose: { type: String, required: true },
    to: { type: String, required: true },
    body: { type: String, default: '' },
    provider: { type: String, default: 'log' }, // 'log' = written to the server log only
    status: { type: String, enum: ['logged', 'sent', 'failed'], required: true },
    providerMessageId: { type: String, default: '' },
    error: { type: String, default: '' },
    durationMs: { type: Number, default: 0 },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },
  },
  { timestamps: true }
);

messageLogSchema.index({ createdAt: -1 });
messageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // keep 90 days

export default mongoose.model('MessageLog', messageLogSchema);
