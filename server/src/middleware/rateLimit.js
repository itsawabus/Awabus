// Simple in-memory request limits (no extra packages). Fine for one server
// instance; with several instances each keeps its own counts.
//
//   router.post('/login', limit('login', { max: 30, windowMinutes: 15 }), login)
//
// A request over the limit gets 429 with a plain message and Retry-After.
// Limits can be switched off (tests only) with RATE_LIMITS=off.

const buckets = new Map(); // key -> array of timestamps

// Drop old entries now and then so memory stays small.
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, hits] of buckets) {
    while (hits.length && hits[0] < cutoff) hits.shift();
    if (!hits.length) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

/**
 * name: which limit this is. by(req): what to count per (default: the caller's IP).
 */
export function limit(name, { max, windowMinutes, by = (req) => req.ip, message } = {}) {
  const windowMs = windowMinutes * 60 * 1000;
  return (req, res, next) => {
    if (process.env.RATE_LIMITS === 'off') return next();
    const who = by(req);
    if (!who) return next();
    const key = `${name}:${String(who).toLowerCase()}`;
    const now = Date.now();
    const hits = (buckets.get(key) || []).filter((t) => t > now - windowMs);
    if (hits.length >= max) {
      const retry = Math.ceil((hits[0] + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(retry));
      res.status(429).json({
        success: false,
        message: message || `Too many attempts. Please wait ${Math.max(1, Math.ceil(retry / 60))} minute(s) and try again.`,
      });
      return;
    }
    hits.push(now);
    buckets.set(key, hits);
    next();
  };
}

// Count per phone / email in the body as well as per IP, so one number or
// account can't be hammered from many addresses.
export const byBodyField = (field) => (req) => (req.body && typeof req.body[field] === 'string' ? req.body[field].replace(/\s/g, '') : null);

// Shared presets for the sign-in and code endpoints.
export const authLimits = {
  signIn: [limit('signin-ip', { max: 30, windowMinutes: 15 })],
  lookup: [limit('lookup-ip', { max: 60, windowMinutes: 15 })],
  sendCode: (field) => [
    limit('code-ip', { max: 10, windowMinutes: 15 }),
    limit('code-target', { max: 5, windowMinutes: 15, by: byBodyField(field), message: 'Too many codes requested for this account. Please wait 15 minutes.' }),
  ],
  checkCode: [limit('verify-ip', { max: 30, windowMinutes: 15 })],
};
