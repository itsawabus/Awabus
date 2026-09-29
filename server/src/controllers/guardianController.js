import asyncHandler from 'express-async-handler';
import Guardian from '../models/Guardian.js';
import { normalizeLanguage } from '../utils/languages.js';
import { searchPattern } from '../utils/search.js';

// @desc    Search/list guardians (used by "Link Existing Parent")
// @route   GET /api/guardians
export const getGuardians = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const filter = {};
  if (q) {
    filter.$or = [
      { firstName: { $regex: searchPattern(q), $options: 'i' } },
      { lastName: { $regex: searchPattern(q), $options: 'i' } },
      { phone: { $regex: searchPattern(q), $options: 'i' } },
      { email: { $regex: searchPattern(q), $options: 'i' } },
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
  const preferredLanguage = normalizeLanguage(req.body.preferredLanguage);
  if (preferredLanguage === null) {
    res.status(400);
    throw new Error('Choose the parent\'s language from the list');
  }
  const guardian = await Guardian.create({ firstName, lastName, relation, phone, email, ...(preferredLanguage ? { preferredLanguage } : {}) });
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
  const preferredLanguage = normalizeLanguage(req.body.preferredLanguage);
  if (preferredLanguage === null) {
    res.status(400);
    throw new Error('Choose the parent\'s language from the list');
  }
  if (preferredLanguage) guardian.preferredLanguage = preferredLanguage;
  await guardian.save();
  res.json({ success: true, data: guardian });
});
