import express from 'express';
import { geocodeGhanaPost } from '../controllers/geocodeController.js';
import { protectAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(protectAdmin);

router.get('/ghanapost', geocodeGhanaPost);

export default router;
