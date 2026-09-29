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
  driverSignOut,
  getTodaysTrip,
  startTrip,
  endTrip,
  pushLocation,
  markAttendance,
  sendDelayBroadcast,
  messageParent,
  getAssistPass,
  createAssistPass,
  deleteAssistPass,
  getTripHistory,
  getTripByIdForDriver,
  getBroadcastHistory,
  getDriverNotifications,
  deleteDriverNotifications,
} from '../controllers/driverAppController.js';
import { protectDriver } from '../middleware/auth.js';
import { authLimits } from '../middleware/rateLimit.js';

const router = express.Router();

// Public
router.post('/auth/check-phone', ...authLimits.lookup, checkDriverPhone);
router.post('/auth/set-password', ...authLimits.signIn, setDriverPassword);
router.post('/auth/login', ...authLimits.signIn, driverLogin);
router.post('/auth/forgot-password', ...authLimits.sendCode('phone'), driverForgotPassword);
router.post('/auth/verify-otp', ...authLimits.checkCode, driverVerifyOtp);
router.post('/auth/resend-otp', ...authLimits.sendCode('phone'), driverResendOtp);
router.post('/auth/reset-password', ...authLimits.checkCode, driverResetPassword);

// Protected
router.get('/me', protectDriver, getDriverMe);
router.post('/sign-out', protectDriver, driverSignOut);
router.get('/notifications', protectDriver, getDriverNotifications);
router.post('/notifications/delete', protectDriver, deleteDriverNotifications);
router.get('/trips/today', protectDriver, getTodaysTrip);
router.get('/trips', protectDriver, getTripHistory);
router.get('/trips/:id', protectDriver, getTripByIdForDriver);
router.post('/trips/:id/start', protectDriver, startTrip);
router.post('/trips/:id/end', protectDriver, endTrip);
router.post('/trips/:id/location', protectDriver, pushLocation);
router.post('/trips/:id/students/:studentId/attendance', protectDriver, markAttendance);
router.post('/trips/:id/delay-broadcast', protectDriver, sendDelayBroadcast);
router.post('/trips/:id/students/:studentId/message', protectDriver, messageParent);
router
  .route('/trips/:id/assist-pass')
  .get(protectDriver, getAssistPass)
  .post(protectDriver, createAssistPass)
  .delete(protectDriver, deleteAssistPass);
router.get('/broadcasts', protectDriver, getBroadcastHistory);

export default router;
