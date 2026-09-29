import express from 'express';
import { getGuardians, createGuardian, updateGuardian } from '../controllers/guardianController.js';
import { protectAdmin, schoolScope } from '../middleware/auth.js';

const router = express.Router();

router.use(protectAdmin, schoolScope);

router.route('/').get(getGuardians).post(createGuardian);
router.route('/:id').put(updateGuardian);

export default router;
