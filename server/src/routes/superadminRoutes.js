import express from 'express';
import { protectAdmin } from '../middleware/auth.js';
import { requireSuperadmin } from '../middleware/superadmin.js';
import {
  getAnalytics,
  listSchools,
  createSchool,
  updateSchoolStatus,
} from '../controllers/superadminController.js';

const router = express.Router();

router.use(protectAdmin, requireSuperadmin);

router.get('/analytics', getAnalytics);
router.get('/schools', listSchools);
router.post('/schools', createSchool);
router.patch('/schools/:id/status', updateSchoolStatus);

export default router;