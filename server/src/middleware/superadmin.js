import asyncHandler from 'express-async-handler';

export const requireSuperadmin = asyncHandler(async (req, res, next) => {
  if (!req.admin || req.admin.role !== 'superadmin') {
    res.status(403);
    throw new Error('Superadmin access required');
  }
  next();
});