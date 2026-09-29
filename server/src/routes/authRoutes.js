import express from 'express';
import {
  login,
  getMe,
  forgotPassword,
  verifyOtp,
  resendOtp,
  resetPassword,
  checkEmail,
  setPassword,
} from '../controllers/authController.js';
import {
  updateProfile,
  requestVerification,
  confirmEmailChange,
  confirmPhoneChange,
  changePassword,
} from '../controllers/accountController.js';
import { authLimits } from '../middleware/rateLimit.js';
import { protectAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', ...authLimits.signIn, login);
router.get('/me', protectAdmin, getMe);
router.put('/me', protectAdmin, updateProfile);
router.post('/me/verification', protectAdmin, ...authLimits.sendCode('purpose'), requestVerification);
router.post('/me/email', protectAdmin, ...authLimits.checkCode, confirmEmailChange);
router.post('/me/phone', protectAdmin, ...authLimits.checkCode, confirmPhoneChange);
router.post('/me/password', protectAdmin, ...authLimits.checkCode, changePassword);
router.post('/forgot-password', ...authLimits.sendCode('email'), forgotPassword);
router.post('/check-email', ...authLimits.lookup, checkEmail);
router.post('/set-password', ...authLimits.signIn, setPassword);
router.post('/verify-otp', ...authLimits.checkCode, verifyOtp);
router.post('/resend-otp', ...authLimits.sendCode('email'), resendOtp);
router.post('/reset-password', ...authLimits.checkCode, resetPassword);

export default router;
