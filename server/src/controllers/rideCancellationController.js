import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Student from '../models/Student.js';
import { CHOICES, cancelRides, undoCancellation, upcomingForStudent } from '../services/rideCancellations.js';

const findStudent = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !(await Student.exists({ _id: req.params.id }))) {
    res.status(404);
    throw new Error('Student not found');
  }
};

// @desc    Upcoming ride cancellations for a student
// @route   GET /api/students/:id/ride-cancellations
export const getRideCancellations = asyncHandler(async (req, res) => {
  await findStudent(req, res);
  res.json({ success: true, data: await upcomingForStudent(req.params.id) });
});

// @desc    Cancel the next morning pick-up, afternoon drop-off, or both
//          body: { choice: 'morning' | 'evening' | 'both' }
// @route   POST /api/students/:id/ride-cancellations
export const createRideCancellation = asyncHandler(async (req, res) => {
  await findStudent(req, res);
  if (!CHOICES[req.body?.choice]) {
    res.status(400);
    throw new Error('Choose the morning pick-up, the afternoon drop-off or both');
  }
  const done = await cancelRides({ studentIds: [req.params.id], choice: req.body.choice, source: 'office', admin: req.admin?._id });
  if (!done.length) {
    res.status(400);
    throw new Error("This student doesn't ride that run");
  }
  res.status(201).json({ success: true, cancelled: done, data: await upcomingForStudent(req.params.id) });
});

// @desc    Undo a ride cancellation (only before that run starts)
// @route   DELETE /api/students/:id/ride-cancellations/:cancellationId
export const deleteRideCancellation = asyncHandler(async (req, res) => {
  await findStudent(req, res);
  if (!mongoose.isValidObjectId(req.params.cancellationId)) {
    res.status(404);
    throw new Error('This cancellation was not found');
  }
  const result = await undoCancellation(req.params.cancellationId);
  if (result.error) {
    res.status(result.status);
    throw new Error(result.error);
  }
  res.json({ success: true, data: await upcomingForStudent(req.params.id) });
});
