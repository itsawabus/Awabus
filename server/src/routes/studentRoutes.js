import express from 'express';
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentOptions,
} from '../controllers/studentController.js';
import {
  getRideCancellations,
  createRideCancellation,
  deleteRideCancellation,
} from '../controllers/rideCancellationController.js';
import { protectAdmin, schoolScope } from '../middleware/auth.js';

const router = express.Router();

router.use(protectAdmin, schoolScope);

router.get('/meta/options', getStudentOptions);
router.route('/').get(getStudents).post(createStudent);
router.route('/:id').get(getStudentById).put(updateStudent).delete(deleteStudent);
router.route('/:id/ride-cancellations').get(getRideCancellations).post(createRideCancellation);
router.delete('/:id/ride-cancellations/:cancellationId', deleteRideCancellation);

export default router;
