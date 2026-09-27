import express from 'express';
import { getTrips, getTripById } from '../controllers/tripController.js';
import { protectAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(protectAdmin);

router.get('/', getTrips);
router.get('/:id', getTripById);

export default router;
