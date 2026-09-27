import express from 'express';
import {
  getBuses,
  getBusById,
  createBus,
  updateBus,
  deleteBus,
  getBusOptions,
} from '../controllers/busController.js';
import { protectAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(protectAdmin);

router.get('/meta/options', getBusOptions);
router.route('/').get(getBuses).post(createBus);
router.route('/:id').get(getBusById).put(updateBus).delete(deleteBus);

export default router;
