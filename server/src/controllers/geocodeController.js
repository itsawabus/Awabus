import asyncHandler from 'express-async-handler';
import { lookupGpsAddress, GpsLookupError } from '../services/ghanaPostGps.js';

// @desc    Resolve a GhanaPostGPS digital address to latitude/longitude
// @route   GET /api/geocode/ghanapost?address=GA-543-0125
export const geocodeGhanaPost = asyncHandler(async (req, res) => {
  try {
    const location = await lookupGpsAddress(req.query.address);
    res.json({ success: true, data: location });
  } catch (err) {
    if (err instanceof GpsLookupError) res.status(err.statusCode);
    throw err;
  }
});
