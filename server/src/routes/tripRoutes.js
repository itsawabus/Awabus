import express from 'express';
import { getTrips, getTripById } from '../controllers/tripController.js';
import { protectAdmin, schoolScope } from '../middleware/auth.js';

const router = express.Router();

router.use(protectAdmin, schoolScope);

router.get('/', getTrips);
router.get('/:id', getTripById);

export default router;
