import mongoose from 'mongoose';
import { normalizePhones } from '../plugins/normalizePhones.js';

const guardianSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    relation: {
      type: String,
      enum: ['Father', 'Mother', 'Guardian', 'Sibling', 'Other'],
      default: 'Guardian',
    },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { timestamps: true }
);

guardianSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});

guardianSchema.set('toJSON', { virtuals: true });
guardianSchema.set('toObject', { virtuals: true });

guardianSchema.plugin(normalizePhones, { paths: ['phone'] });
export default mongoose.model('Guardian', guardianSchema);
