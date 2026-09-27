import asyncHandler from 'express-async-handler';
import Guardian from '../models/Guardian.js';

// @desc    Search/list guardians (used by "Link Existing Parent")
// @route   GET /api/guardians
export const getGuardians = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const filter = {};
  if (q) {
    filter.$or = [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
    ];
  }
  const guardians = await Guardian.find(filter).sort({ createdAt: 1 }).limit(50);
  res.json({ success: true, data: guardians });
});

// @desc    Create a guardian profile
// @route   POST /api/guardians
export const createGuardian = asyncHandler(async (req, res) => {
  const { firstName, lastName, relation, phone, email } = req.body;
  if (!firstName || !lastName || !phone) {
    res.status(400);
    throw new Error('First name, last name and phone are required');
  }
  const guardian = await Guardian.create({ firstName, lastName, relation, phone, email });
  res.status(201).json({ success: true, data: guardian });
});

// @desc    Update a guardian profile
// @route   PUT /api/guardians/:id
export const updateGuardian = asyncHandler(async (req, res) => {
  const guardian = await Guardian.findById(req.params.id);
  if (!guardian) {
    res.status(404);
    throw new Error('Guardian not found');
  }
  ['firstName', 'lastName', 'relation', 'phone', 'email'].forEach((f) => {
    if (req.body[f] !== undefined) guardian[f] = req.body[f];
  });
  await guardian.save();
  res.json({ success: true, data: guardian });
});
