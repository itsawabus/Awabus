import express from 'express';
import { getDashboard } from '../controllers/dashboardController.js';
import { protectAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protectAdmin, getDashboard);

export default router;
