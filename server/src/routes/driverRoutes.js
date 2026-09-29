import express from 'express';
import {
  getDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
  getDriverOptions,
  validateLicense,
  createDriverSetupCode,
} from '../controllers/driverController.js';
import { protectAdmin, schoolScope } from '../middleware/auth.js';

const router = express.Router();

router.use(protectAdmin, schoolScope);

router.get('/meta/options', getDriverOptions);
router.post('/validate-license', validateLicense);
router.route('/').get(getDrivers).post(createDriver);
router.post('/:id/setup-code', createDriverSetupCode);
router.route('/:id').get(getDriverById).put(updateDriver).delete(deleteDriver);

export default router;
