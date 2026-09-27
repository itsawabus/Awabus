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
  confirmPasswordReveal,
} from '../controllers/accountController.js';
import { protectAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.get('/me', protectAdmin, getMe);
router.put('/me', protectAdmin, updateProfile);
router.post('/me/verification', protectAdmin, requestVerification);
router.post('/me/email', protectAdmin, confirmEmailChange);
router.post('/me/phone', protectAdmin, confirmPhoneChange);
router.post('/me/password', protectAdmin, changePassword);
router.post('/me/reveal-password', protectAdmin, confirmPasswordReveal);
router.post('/forgot-password', forgotPassword);
router.post('/check-email', checkEmail);
router.post('/set-password', setPassword);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/reset-password', resetPassword);

export default router;
