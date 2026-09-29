import express from 'express';
import { getMySchool, updateSchoolLocation } from '../controllers/schoolController.js';
import { protectAdmin, schoolScope } from '../middleware/auth.js';

// The signed-in admin's own school (or the school a superadmin is viewing).
const router = express.Router();
router.use(protectAdmin, schoolScope);
router.get('/', getMySchool);
router.put('/location', updateSchoolLocation);

export default router;
