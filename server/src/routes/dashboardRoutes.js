import express from 'express';
import { getDashboard } from '../controllers/dashboardController.js';
import { protectAdmin, schoolScope } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protectAdmin, schoolScope, getDashboard);

export default router;
