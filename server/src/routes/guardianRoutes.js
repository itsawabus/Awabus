import express from 'express';
import { getGuardians, createGuardian, updateGuardian } from '../controllers/guardianController.js';
import { protectAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(protectAdmin);

router.route('/').get(getGuardians).post(createGuardian);
router.route('/:id').put(updateGuardian);

export default router;
