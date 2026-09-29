import express from 'express';
import { getTrackingOverview, getTrackingTripDetail } from '../controllers/trackingController.js';
import { protectAdmin, schoolScope } from '../middleware/auth.js';

const router = express.Router();

router.use(protectAdmin, schoolScope);

router.get('/overview', getTrackingOverview);
router.get('/trips/:tripId', getTrackingTripDetail);

export default router;
