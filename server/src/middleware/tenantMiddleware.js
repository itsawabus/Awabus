import { tenantContext } from '../utils/tenantContext.js';

/**
 * Wire this in ONCE, after whatever auth middleware sets req.admin / req.driver / req.user.
 * Every controller downstream keeps calling Model.find()/create()/etc exactly as before —
 * the tenantScope mongoose plugin does the actual filtering.
 *
 * Example (app.js / a protected router):
 *   router.use(protect, withTenant, adminRoutes);
 *
 * Adjust the `resolveSchoolId` extraction below to match whatever your auth
 * middleware actually attaches to `req` (req.admin, req.user, a decoded JWT, etc).
 */
const resolveSchoolId = (req) =>
  req.admin?.school || req.user?.school || req.driver?.school || req.headers['x-school-id'];

export const withTenant = (req, res, next) => {
  const schoolId = resolveSchoolId(req);

  if (!schoolId) {
    return res.status(400).json({ message: 'No school context found for this request.' });
  }

  req.school = schoolId; // handy if a controller ever needs it directly
  tenantContext.run(schoolId, next);
};

export default withTenant;