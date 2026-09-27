import mongoose from 'mongoose';
import { tenantScope } from '../plugins/tenantScope.js';

const stopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    order: { type: Number, required: true },
    lat: Number,
    lng: Number,
  },
  { _id: false }
);

const routeSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },

    routeId: { type: String, required: true, trim: true }, // e.g. RT-001, unique per school
    name: { type: String, required: true, trim: true }, // e.g. West Legon - Ashongman
    assignedBus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', default: null },
    assignedDriver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    stops: [stopSchema],
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { timestamps: true }
);

routeSchema.virtual('studentCount').get(function studentCount() {
  return this.students?.length || 0;
});

// routeId (e.g. "RT-001") can repeat across different schools, just not within the same one
routeSchema.index({ school: 1, routeId: 1 }, { unique: true });
routeSchema.index({ school: 1, status: 1 });

routeSchema.set('toJSON', { virtuals: true });
routeSchema.set('toObject', { virtuals: true });

routeSchema.plugin(tenantScope);

export default mongoose.model('Route', routeSchema);