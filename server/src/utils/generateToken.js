import jwt from 'jsonwebtoken';

// `extra` lets callers embed things the auth middleware needs before it can
// even query the DB — chiefly `{ school }`, so protectAdmin/protectDriver can
// establish tenant context straight from the token instead of doing an
// unscoped lookup first.
export const generateToken = (id, type = 'admin', extra = {}) =>
  jwt.sign({ id, type, ...extra }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

export default generateToken;