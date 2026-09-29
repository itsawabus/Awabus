// Whether a school's accounts may use AwaBus right now. Suspending a school on
// the Platform page blocks its admins and drivers at sign-in and on every
// request. Status is cached for 30 s; suspending clears the cache at once.
import School from '../models/School.js';
import { tenantContext } from './tenantContext.js';

const TTL_MS = 30 * 1000;
const cache = new Map(); // schoolId -> { status, at }

export async function schoolStatus(schoolId) {
  if (!schoolId) return null;
  const key = String(schoolId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.status;
  const school = await tenantContext.runAsSystem(() => School.findById(key).select('status').lean());
  const status = school ? school.status || 'Active' : 'Missing';
  cache.set(key, { status, at: Date.now() });
  return status;
}

export const forgetSchoolStatus = (schoolId) => cache.delete(String(schoolId));

/** Error to throw when a school can't be used; the apps sign out on this code. */
export function accessError(res, code, message) {
  res.status(403);
  const err = new Error(message);
  err.errorCode = code;
  return err;
}

export const SCHOOL_SUSPENDED_MESSAGE = "This school's AwaBus account is suspended. Please contact AwaBus support.";
export const DRIVER_INACTIVE_MESSAGE = 'Your driver account is inactive. Please contact your school.';
