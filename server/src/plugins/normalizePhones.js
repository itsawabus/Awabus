import { normalizeGhanaPhone } from '../utils/phone.js';

/**
 * Stores the given phone fields as +233XXXXXXXXX whenever a document is saved,
 * whatever format the number was typed in (0244..., 244..., +233 24 ...).
 * Update queries (findByIdAndUpdate etc.) bypass this and must normalize themselves.
 */
export function normalizePhones(schema, { paths }) {
  schema.pre('validate', function normalize(next) {
    paths.forEach((path) => {
      const value = this.get(path);
      if (value && this.isModified(path)) this.set(path, normalizeGhanaPhone(value));
    });
    next();
  });
}
