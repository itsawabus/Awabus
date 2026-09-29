import mongoose from 'mongoose';
import { tenantScope } from '../plugins/tenantScope.js';

// Last number handed out for a display code series (e.g. "ST-2026", "RT", "TRP"),
// per school. See utils/idGenerator.js.
const counterSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    key: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: false }
);

counterSchema.index({ school: 1, key: 1 }, { unique: true });
counterSchema.plugin(tenantScope);

export default mongoose.model('Counter', counterSchema);
