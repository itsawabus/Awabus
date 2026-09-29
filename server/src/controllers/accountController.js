import asyncHandler from 'express-async-handler';
import Admin from '../models/Admin.js';
import OtpToken from '../models/OtpToken.js';
import { generateOtpCode, getOtpExpiry, sendOtpEmail, sendOtpSms } from '../utils/otp.js';
import { ghanaPhoneVariants, isValidGhanaPhone, normalizeGhanaPhone } from '../utils/phone.js';
import { checkPasswordStrength } from '../utils/password.js';
import { tenantContext } from '../utils/tenantContext.js';
import { MAX_OTP_ATTEMPTS } from './authController.js';
import generateToken from '../utils/generateToken.js';

// Account settings for the signed-in admin (req.admin, set by protectAdmin).
// Changing the email or phone needs a code sent to the NEW address, proving the
// admin controls it; resetting the password needs a code sent to the email or
// phone already on the account.

const RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const maskEmail = (email) => email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${'*'.repeat(Math.max(b.length, 1))}${c}`);
// Shown the local way (0XX), e.g. +233244123456 -> 024*****3456
const maskPhone = (phone) => {
  const local = phone.startsWith('+233') ? `0${phone.slice(4)}` : phone;
  return `${local.slice(0, 3)}*****${local.slice(-4)}`;
};

// Email and phone must be unique across schools for sign-in / password reset
// lookups to be unambiguous, so these checks deliberately run system-wide.
const emailTaken = (email, adminId) =>
  tenantContext.runAsSystem(() => Admin.exists({ email, _id: { $ne: adminId } }));
const phoneTaken = (phone, adminId) =>
  tenantContext.runAsSystem(() => Admin.exists({ phone: { $in: ghanaPhoneVariants(phone) }, _id: { $ne: adminId } }));

async function issueCode(res, admin, { purpose, target, newValue, channel }) {
  const recent = await OtpToken.findOne({ admin: admin._id, purpose, consumed: false }).sort({ createdAt: -1 });
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    res.status(429);
    throw new Error('Please wait a minute before requesting another code.');
  }
  // Only the newest code for a purpose is valid.
  await OtpToken.updateMany({ admin: admin._id, purpose, consumed: false }, { consumed: true });

  const code = generateOtpCode();
  await OtpToken.create({ admin: admin._id, purpose, target, newValue, code, expiresAt: getOtpExpiry() });
  const delivered =
    channel === 'email'
      ? await sendOtpEmail(target, code, { purpose: 'account_verification', school: admin.school })
      : await sendOtpSms(target, code, { purpose: 'account_verification', school: admin.school });
  if (!delivered) {
    // Cancel the unsent code so the admin can ask again straight away.
    await OtpToken.updateMany({ admin: admin._id, purpose, consumed: false }, { consumed: true });
    res.status(502);
    throw new Error("We couldn't send the code right now. Please try again in a few minutes.");
  }
}

async function consumeCode(res, admin, purpose, code) {
  const otp = await OtpToken.findOne({ admin: admin._id, purpose, consumed: false }).sort({ createdAt: -1 });
  if (!otp) {
    res.status(400);
    throw new Error('No active code. Request a new one.');
  }
  if (otp.expiresAt < new Date()) {
    res.status(400);
    throw new Error('The code has expired. Request a new one.');
  }
  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    res.status(429);
    throw new Error('Too many incorrect attempts. Request a new code.');
  }
  if (otp.code !== String(code || '').trim()) {
    otp.attempts += 1;
    await otp.save();
    res.status(400);
    throw new Error('Invalid code. Please try again.');
  }
  otp.consumed = true;
  await otp.save();
  return otp;
}

// @desc    Update the signed-in admin's name / photo
// @route   PUT /api/auth/me
export const updateProfile = asyncHandler(async (req, res) => {
  const admin = req.admin;
  const { name, avatarUrl } = req.body;
  if (name !== undefined) {
    if (!String(name).trim()) {
      res.status(400);
      throw new Error('Name is required');
    }
    admin.name = String(name).trim();
  }
  if (avatarUrl !== undefined) admin.avatarUrl = avatarUrl || '';
  await admin.save();
  res.json({ success: true, admin: admin.toSafeObject() });
});

// @desc    Send a verification code for an email, phone or password change
// @route   POST /api/auth/me/verification
// @body    { purpose: 'change_email', email } | { purpose: 'change_phone', phone }
//          | { purpose: 'change_password', channel: 'email' | 'phone' }
export const requestVerification = asyncHandler(async (req, res) => {
  const admin = req.admin;
  const { purpose } = req.body;

  if (purpose === 'change_email') {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      res.status(400);
      throw new Error('Enter a valid email address');
    }
    if (email === admin.email) {
      res.status(400);
      throw new Error('That is already your email address');
    }
    if (await emailTaken(email, admin._id)) {
      res.status(409);
      throw new Error('That email address is already used by another account');
    }
    await issueCode(res, admin, { purpose, target: email, newValue: email, channel: 'email' });
    return res.json({ success: true, sentTo: maskEmail(email) });
  }

  if (purpose === 'change_phone') {
    if (!isValidGhanaPhone(req.body.phone)) {
      res.status(400);
      throw new Error('Enter a valid phone number, e.g. 024 412 3456');
    }
    const phone = normalizeGhanaPhone(req.body.phone);
    if (normalizeGhanaPhone(admin.phone) === phone) {
      res.status(400);
      throw new Error('That is already your phone number');
    }
    if (await phoneTaken(phone, admin._id)) {
      res.status(409);
      throw new Error('That phone number is already used by another account');
    }
    await issueCode(res, admin, { purpose, target: phone, newValue: phone, channel: 'phone' });
    return res.json({ success: true, sentTo: maskPhone(phone) });
  }

  if (purpose === 'change_password') {
    const channel = req.body.channel === 'phone' ? 'phone' : 'email';
    const target = channel === 'email' ? admin.email : normalizeGhanaPhone(admin.phone);
    if (!target) {
      res.status(400);
      throw new Error(`There is no ${channel} on this account to send a code to`);
    }
    await issueCode(res, admin, { purpose, target, channel });
    return res.json({ success: true, sentTo: channel === 'email' ? maskEmail(target) : maskPhone(target) });
  }

  res.status(400);
  throw new Error('Unknown verification purpose');
});

// @desc    Confirm a new email address with the code sent to it
// @route   POST /api/auth/me/email
export const confirmEmailChange = asyncHandler(async (req, res) => {
  const admin = req.admin;
  const otp = await consumeCode(res, admin, 'change_email', req.body.code);
  if (await emailTaken(otp.newValue, admin._id)) {
    res.status(409);
    throw new Error('That email address is already used by another account');
  }
  admin.email = otp.newValue;
  await admin.save();
  res.json({ success: true, admin: admin.toSafeObject() });
});

// @desc    Confirm a new phone number with the code sent to it
// @route   POST /api/auth/me/phone
export const confirmPhoneChange = asyncHandler(async (req, res) => {
  const admin = req.admin;
  const otp = await consumeCode(res, admin, 'change_phone', req.body.code);
  if (await phoneTaken(otp.newValue, admin._id)) {
    res.status(409);
    throw new Error('That phone number is already used by another account');
  }
  admin.phone = otp.newValue;
  await admin.save();
  res.json({ success: true, admin: admin.toSafeObject() });
});

// @desc    Reset password while signed in: new password + the code sent to the
//          account's email or phone (the code is the proof, like Forgot password)
// @route   POST /api/auth/me/password
export const changePassword = asyncHandler(async (req, res) => {
  const { newPassword, code } = req.body;
  const admin = req.admin;

  const weak = checkPasswordStrength(newPassword, { email: admin.email, name: admin.name });
  if (weak) {
    res.status(400);
    throw new Error(weak);
  }
  if (admin.password && (await admin.matchPassword(newPassword))) {
    res.status(400);
    throw new Error('Choose a password different from your current one');
  }

  await consumeCode(res, admin, 'change_password', code);
  admin.password = newPassword;
  await admin.save();
  // Other sessions are now signed out; this one continues with a fresh token.
  res.json({
    success: true,
    message: 'Your password has been changed. Other devices have been signed out.',
    token: generateToken(admin._id, 'admin', { school: admin.school, role: admin.role }),
  });
});
