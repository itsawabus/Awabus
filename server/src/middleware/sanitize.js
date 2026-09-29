// Request bodies are JSON from the apps and never legitimately contain keys
// starting with "$" (MongoDB operators) or containing "." (nested paths).
// Dropping them stops input like { "email": { "$ne": null } } from turning
// into a database query operator.
const clean = (value, depth = 0) => {
  if (depth > 20 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  if (Buffer.isBuffer(value) || value instanceof Date) return value;
  const entries = Object.entries(value);
  const out = {};
  for (const [k, v] of entries) {
    if (k.startsWith('$') || k.includes('.')) continue;
    const cleaned = clean(v, depth + 1);
    if (cleaned !== undefined) out[k] = cleaned;
  }
  // A value made only of operators ({ "$ne": null }) is dropped entirely, so
  // the field reads as missing instead of as an unexpected empty object.
  if (entries.length && !Object.keys(out).length && entries.every(([k]) => k.startsWith('$'))) return undefined;
  return out;
};

export const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) req.body = clean(req.body);
  next();
};

export default sanitizeBody;
