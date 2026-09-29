import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import School from '../models/School.js';
import { tenantContext } from '../utils/tenantContext.js';
import { schoolStatus } from '../utils/access.js';
import { issuedBeforePasswordChange } from '../utils/resetToken.js';
import { schoolRoom } from './rooms.js';

const refuse = (next, message) => next(Object.assign(new Error(message), { data: { code: 'UNAUTHORIZED' } }));

/**
 * Checks the sign-in token sent with the connection (socket.handshake.auth.token)
 * and puts the connection in its school's room. The same checks as the admin
 * API apply: a valid admin token, password not changed since, school active.
 * A superadmin passes auth.viewSchool and joins only that school's room.
 */
export const socketAuth = async (socket, next) => {
  const { token, viewSchool } = socket.handshake.auth || {};
  if (!token) return refuse(next, 'Sign in required');
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return refuse(next, 'Sign in required');
  }
  if (decoded.type !== 'admin') return refuse(next, 'Sign in required');

  try {
    await tenantContext.runAsSystem(async () => {
      const admin = await Admin.findById(decoded.id).select('role school passwordChangedAt');
      if (!admin || issuedBeforePasswordChange(decoded, admin)) throw new Error('Sign in required');

      let school;
      if (admin.role === 'superadmin') {
        if (!viewSchool) return; // connected, but hears nothing until a school is chosen
        if (!mongoose.isValidObjectId(viewSchool) || !(await School.exists({ _id: viewSchool }))) {
          throw new Error('That school was not found');
        }
        school = viewSchool;
      } else {
        if (!decoded.school || String(admin.school) !== String(decoded.school)) throw new Error('Sign in required');
        if ((await schoolStatus(decoded.school)) !== 'Active') throw new Error('School suspended');
        school = decoded.school;
      }
      socket.data.school = String(school);
      socket.join(schoolRoom(school));
    });
  } catch (err) {
    return refuse(next, err.message);
  }
  return next();
};

export default socketAuth;
