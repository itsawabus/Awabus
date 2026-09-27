import mongoose from 'mongoose';
import { tenantScope } from '../plugins/tenantScope.js';

const busSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },

    plateNumber: { type: String, required: true, uppercase: true, trim: true }, // unique per school
    name: { type: String, required: true, trim: true }, // e.g. "Bus A (Yellow Submarine)"
    type: {
      type: String,
      enum: ['Cruiser', 'Coaster', 'Standard', 'Mini'],
      default: 'Standard',
    },
    capacity: { type: Number, required: true },
    assignedRoute: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', default: null },
    assignedDriver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },
    status: { type: String, enum: ['Active', 'Idle', 'Maintenance'], default: 'Idle' },
    // Live GPS state used by the Live Tracking screen / driver app
    lastKnownLocation: {
      lat: Number,
      lng: Number,
      heading: Number,
      updatedAt: Date,
    },
    gpsSignal: { type: String, enum: ['ok', 'lost', 'offline'], default: 'offline' },
  },
  { timestamps: true }
);

busSchema.virtual('seatsFilled').get(function seatsFilled() {
  return this._seatsFilled || 0;
});

// plateNumber only needs to be unique within a school, not globally
// (two different school tenants could otherwise never both onboard, say, a leased/rebadged bus record)
busSchema.index({ school: 1, plateNumber: 1 }, { unique: true });
busSchema.index({ school: 1, status: 1 });

busSchema.set('toJSON', { virtuals: true });
busSchema.set('toObject', { virtuals: true });

busSchema.plugin(tenantScope);

export default mongoose.model('Bus', busSchema);