import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import Admin from '../models/Admin.js';
import Driver from '../models/Driver.js';
import { tenantContext } from '../utils/tenantContext.js';

const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer')) {
    return authHeader.split(' ')[1];
  }
  return null;
};

// Protects Admin Portal routes. Expects: Authorization: Bearer <token>
// Handles both tenant admins (decoded.school present) and superadmins
// (decoded.school is null/absent — they operate via runAsSystem instead
// of a bound tenant context).
export const protectAdmin = asyncHandler(async (req, res, next) => {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized, token failed or expired');
  }

  if (decoded.type !== 'admin') {
    res.status(401);
    throw new Error('Not authorized for admin portal');
  }

  if (decoded.role === 'superadmin') {
    // Superadmins have no tenant — run the lookup as system and skip
    // establishing a tenant context entirely. Any tenant-scoped queries
    // deeper in the request must use tenantContext.runAsSystem() themselves
    // (as superadminController.js already does).
    return tenantContext.runAsSystem(async () => {
      const admin = await Admin.findById(decoded.id);
      if (!admin || admin.role !== 'superadmin') {
        res.status(401);
        throw new Error('Superadmin account no longer exists');
      }
      req.admin = admin;
      req.school = null;
      next();
    });
  }

  if (!decoded.school) {
    // Token was issued before `school` was added to the payload, or is
    // otherwise malformed — force a fresh login rather than guessing a tenant.
    res.status(401);
    throw new Error('Session out of date, please sign in again');
  }

  // Establish tenant context from the token FIRST, then look the admin up —
  // that way the very first DB call is already scoped, and every controller
  // downstream inherits this same context automatically (AsyncLocalStorage
  // follows the whole async chain kicked off from inside .run(), including
  // this next() call and everything it leads to). This replaces the need for
  // a separate withTenant middleware on these routes.
  await tenantContext.run(decoded.school, async () => {
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      res.status(401);
      throw new Error('Admin account no longer exists');
    }
    req.admin = admin;
    req.school = decoded.school;
    next();
  });
});

// Restricts a route to superadmins only. Must run after protectAdmin.
export const requireSuperadmin = asyncHandler(async (req, res, next) => {
  if (!req.admin || req.admin.role !== 'superadmin') {
    res.status(403);
    throw new Error('Superadmin access required');
  }
  next();
});

// Protects Driver App routes (server API is ready even though the driver app UI is not built yet).
export const protectDriver = asyncHandler(async (req, res, next) => {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized, token failed or expired');
  }

  if (decoded.type !== 'driver') {
    res.status(401);
    throw new Error('Not authorized for driver app');
  }

  if (!decoded.school) {
    res.status(401);
    throw new Error('Session out of date, please sign in again');
  }

  await tenantContext.run(decoded.school, async () => {
    const driver = await Driver.findById(decoded.id);
    if (!driver) {
      res.status(401);
      throw new Error('Driver account no longer exists');
    }
    req.driver = driver;
    req.school = decoded.school;
    next();
  });
});