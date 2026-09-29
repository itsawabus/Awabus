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
    // Boarding / drop-off text to the parent (services/parentAlerts.js).
    alertStatus: { type: String, default: 'Not yet alerted' },
    alertTime: { type: String, default: '' },
    alertFor: { type: String, default: '' }, // which scan the alert was about
    // When the bus first came within the student's notification zone on this trip.
    nearHomeAt: { type: Date, default: null },
    nearHomeAlert: { type: String, default: '' },
    // The arrival call to the parent, when a voice provider is on
    // (services/voice): its id at the provider, how it went
    // (calling | ringing | answered | cut | declined | no_answer | failed),
    // when that was last updated and how long the parent listened.
    callId: { type: String, default: '' },
    callStatus: { type: String, default: '' },
    callAt: { type: Date, default: null },
    callSeconds: { type: Number, default: null },
    // Text sent instead when the call was not picked up ('' = none needed yet).
    callFallback: { type: String, default: '' },
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
    by: { type: String, default: '' }, // '' = the driver, or "Bus assistant (name)"
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
    // true when AwaBus ended the trip because the driver never did (services/staleTrips.js)
    autoEnded: { type: Boolean, default: false },

    // 'morning' = pick-up (home to school, started before noon), 'evening' =
    // afternoon drop-off (school to home, from noon). null on old trips.
    session: { type: String, enum: ['morning', 'evening', null], default: null },

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
    // Whose phone liveLocation came from: the driver's, or the bus assistant's
    // as a backup while the driver's phone is not reporting (services/busPosition.js).
    locationSource: { type: String, enum: ['driver', 'assistant'], default: 'driver' },
    driverLocation: { lat: Number, lng: Number, heading: Number, updatedAt: Date },
    driverSeenAt: { type: Date, default: null }, // last live reading from the driver (server time)
    assistantLocation: { lat: Number, lng: Number, heading: Number, accuracy: Number, updatedAt: Date, name: String },
    // Is the assistant's phone on the bus (near the driver's)? null = not compared yet.
    assistantOnBus: { type: Boolean, default: null },
    distanceCoveredKm: { type: Number, default: 0 },
    etaMinutes: { type: Number, default: 0 },

    delayBroadcasts: [delayBroadcastSchema],
    // Bus assistant pass (teacher on bus duty, via a QR code in the driver app).
    // Only a hash of the pass is kept; it works while this trip has not ended
    // and until expiresAt. See services/assistPass.js.
    assistPass: {
      hash: { type: String, default: '' },
      createdAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
    },
    // Who used the pass, for the trip record.
    assistants: [{ name: { type: String, default: '' }, firstSeenAt: { type: Date, default: Date.now }, _id: false }],
    // Texts sent from the bus to one student's parent (driver app message button).
    parentMessages: [
      {
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
        text: { type: String, default: '' },
        sentAt: { type: Date, default: Date.now },
        status: { type: String, default: '' }, // sent | logged | failed
        by: { type: String, default: '' }, // '' = the driver, or "Bus assistant (name)"
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

// tripCode only needs to be unique within a school, not globally
tripSchema.index({ school: 1, tripCode: 1 }, { unique: true });
// Looking up a bus assistant pass (across schools: the pass itself says which trip).
tripSchema.index({ 'assistPass.hash': 1 }, { sparse: true });
// Finding the trip row for a call result (webhook, across schools).
tripSchema.index({ 'studentProgress.callId': 1 }, { sparse: true });
// common query pattern: "today's trips for this school"
tripSchema.index({ school: 1, date: -1 });
tripSchema.index({ school: 1, status: 1 });

tripSchema.plugin(tenantScope);

export default mongoose.model('Trip', tripSchema);