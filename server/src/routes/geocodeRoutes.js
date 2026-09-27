import express from 'express';
import { geocodeGhanaPost } from '../controllers/geocodeController.js';
import { protectAdmin, schoolScope } from '../middleware/auth.js';

const router = express.Router();

router.use(protectAdmin, schoolScope);

router.get('/ghanapost', geocodeGhanaPost);

export default router;
