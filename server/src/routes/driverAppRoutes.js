import express from 'express';
import {
  checkDriverPhone,
  setDriverPassword,
  driverLogin,
  driverForgotPassword,
  driverVerifyOtp,
  driverResendOtp,
  driverResetPassword,
  getDriverMe,
  getTodaysTrip,
  startTrip,
  endTrip,
  pushLocation,
  markAttendance,
  sendDelayBroadcast,
  getTripHistory,
  getTripByIdForDriver,
  getBroadcastHistory,
} from '../controllers/driverAppController.js';
import { protectDriver } from '../middleware/auth.js';

const router = express.Router();

// Public
router.post('/auth/check-phone', checkDriverPhone);
router.post('/auth/set-password', setDriverPassword);
router.post('/auth/login', driverLogin);
router.post('/auth/forgot-password', driverForgotPassword);
router.post('/auth/verify-otp', driverVerifyOtp);
router.post('/auth/resend-otp', driverResendOtp);
router.post('/auth/reset-password', driverResetPassword);

// Protected
router.get('/me', protectDriver, getDriverMe);
router.get('/trips/today', protectDriver, getTodaysTrip);
router.get('/trips', protectDriver, getTripHistory);
router.get('/trips/:id', protectDriver, getTripByIdForDriver);
router.post('/trips/:id/start', protectDriver, startTrip);
router.post('/trips/:id/end', protectDriver, endTrip);
router.post('/trips/:id/location', protectDriver, pushLocation);
router.post('/trips/:id/students/:studentId/attendance', protectDriver, markAttendance);
router.post('/trips/:id/delay-broadcast', protectDriver, sendDelayBroadcast);
router.get('/broadcasts', protectDriver, getBroadcastHistory);

export default router;
