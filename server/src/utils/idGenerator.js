// Generates human-friendly, auto-incrementing display IDs (RT-001, ST-2026-001, TRP-0001, ...).
//
// Each series has a per-school counter that is increased atomically, so two
// records created at the same moment can never get the same code. The first
// time a series is used, its counter starts from the highest code already in
// the collection (so existing data carries on where it left off).
import Counter from '../models/Counter.js';
import { tenantContext } from './tenantContext.js';

const pad = (num, size) => String(num).padStart(size, '0');

async function highestExisting(Model, field, regex) {
  const docs = await Model.find({ [field]: regex }).select(field).lean();
  let max = 0;
  docs.forEach((doc) => {
    const match = doc[field].match(regex);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });
  return max;
}

async function nextNumber(key, Model, field, regex) {
  const school = tenantContext.getSchool();
  const bump = () => Counter.findOneAndUpdate({ school, key }, { $inc: { seq: 1 } }, { new: true });
  let counter = await bump();
  if (!counter) {
    const max = await highestExisting(Model, field, regex);
    try {
      await Counter.create({ school, key, seq: max });
    } catch (err) {
      if (err.code !== 11000) throw err; // another request created it first: fine
    }
    counter = await bump();
  }
  return counter.seq;
}

export const nextSequentialCode = async (Model, field, prefix, size = 3) => {
  const regex = new RegExp(`^${prefix}(\\d{${size}})$`);
  return `${prefix}${pad(await nextNumber(prefix, Model, field, regex), size)}`;
};

export const nextYearCode = async (Model, field, prefix, year = new Date().getFullYear(), size = 3) => {
  const regex = new RegExp(`^${prefix}-${year}-(\\d{${size}})$`);
  return `${prefix}-${year}-${pad(await nextNumber(`${prefix}-${year}`, Model, field, regex), size)}`;
};
