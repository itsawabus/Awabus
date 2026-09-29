import express from 'express';
import { getTrackingOverview, getTrackingTripDetail, getTrackingTrail } from '../controllers/trackingController.js';
import { protectAdmin, schoolScope } from '../middleware/auth.js';

const router = express.Router();

router.use(protectAdmin, schoolScope);

router.get('/overview', getTrackingOverview);
router.get('/trips/:tripId', getTrackingTripDetail);
router.get('/trips/:tripId/trail', getTrackingTrail);

export default router;
