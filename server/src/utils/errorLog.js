// The last server errors (HTTP 500s), kept in memory for the System page so
// developers don't have to dig through host logs. Cleared when the server restarts.
const MAX = 100;
const entries = [];
let total = 0;

export function recordError(err, req, status) {
  total += 1;
  entries.unshift({
    at: new Date().toISOString(),
    status,
    method: req.method,
    path: (req.originalUrl || req.url || '').split('?')[0], // no query strings: they can hold personal data
    message: String(err?.message || err).slice(0, 500),
    where: String(err?.stack || '').split('\n').slice(1, 3).map((l) => l.trim()).join(' | ').slice(0, 300),
    role: req.admin?.role || (req.driver ? 'driver' : 'anonymous'),
  });
  if (entries.length > MAX) entries.length = MAX;
}

export const recentErrors = () => ({ total, entries });
export const clearErrors = () => {
  entries.length = 0;
};
