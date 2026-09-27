import mongoose from 'mongoose';
import { tenantScope } from '../plugins/tenantScope.js';

const timelineEventSchema = new mongoose.Schema(
  {
    time: { type: String, required: true }, // "06:43"
    title: { type: String, required: true },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const stopSchema = new mongoose.Schema(
  {
    name: String,
    order: Number,
    lat: Number,
    lng: Number,
  },
  { _id: false }
);

const studentProgressSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    attendance: {
      type: String,
      enum: ['Present', 'Absent', 'Expected', 'Cancelled'],
      default: 'Expected',
    },
    alertStatus: { type: String, default: 'Not yet alerted' },
    alertTime: { type: String, default: '' },
    dropoffStatus: {
      type: String,
      enum: ['Pending', 'On board', 'Dropped off', 'Not on board', 'Boarding now'],
      default: 'Pending',
    },
  },
  { _id: false }
);

const delayBroadcastSchema = new mongoose.Schema(
  {
    reason: { type: String, required: true },
    message: { type: String, default: '' },
    sentAt: { type: Date, default: Date.now },
    recipientCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },

    tripCode: { type: String, required: true, trim: true }, // TRP-0108, unique per school
    route: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
    bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },

    date: { type: Date, required: true },
    departureTime: { type: String, default: '' },
    arrivalTime: { type: String, default: '' },
    durationMinutes: { type: Number, default: 0 },
    // Raw timestamps (departureTime/arrivalTime above are display strings) —
    // used by the driver app to compute a live elapsed timer and an exact duration.
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ['Completed', 'In Progress', 'Delayed', 'Cancelled', 'Scheduled'],
      default: 'Scheduled',
    },

    stops: [stopSchema],
    timeline: [timelineEventSchema],
    studentProgress: [studentProgressSchema],

    // Live tracking fields for in-progress trips
    liveLocation: {
      lat: Number,
      lng: Number,
      heading: Number,
      updatedAt: Date,
    },
    gpsSignal: { type: String, enum: ['ok', 'lost', 'offline'], default: 'ok' },
    distanceCoveredKm: { type: Number, default: 0 },
    etaMinutes: { type: Number, default: 0 },

    delayBroadcasts: [delayBroadcastSchema],
  },
  { timestamps: true }
);

// tripCode only needs to be unique within a school, not globally
tripSchema.index({ school: 1, tripCode: 1 }, { unique: true });
// common query pattern: "today's trips for this school"
tripSchema.index({ school: 1, date: -1 });
tripSchema.index({ school: 1, status: 1 });

tripSchema.plugin(tenantScope);

export default mongoose.model('Trip', tripSchema);