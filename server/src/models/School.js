import mongoose from 'mongoose';
import { normalizePhones } from '../plugins/normalizePhones.js';

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Short code used in URLs/subdomains/login screens, e.g. "SCH-001"
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    address: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    logoUrl: { type: String, default: '' },
    timezone: { type: String, default: 'Africa/Accra' },
    // Where the school is (from its GhanaPost GPS address), for "At school":
    // on the morning run, children picked up are marked at school when the bus
    // comes within arrivalRadius metres (services/schoolArrival.js).
    gpsAddress: { type: String, trim: true, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    arrivalRadius: { type: Number, default: 150 },
    autoAtSchool: { type: Boolean, default: true },
    status: { type: String, enum: ['Active', 'Suspended', 'Inactive'], default: 'Active' },
  },
  { timestamps: true }
);

schoolSchema.plugin(normalizePhones, { paths: ['contactPhone'] });
export default mongoose.model('School', schoolSchema);