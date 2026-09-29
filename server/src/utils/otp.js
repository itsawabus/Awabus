import crypto from 'node:crypto';
import { sendSms as deliverSms, sendEmail as deliverEmail } from '../services/messaging/index.js';

// OTP generation + delivery. Delivery goes through services/messaging, which
// records every message and uses the SMS provider once one is switched on
// (until then the message is written to the server log, as before).

const logCodes = () => process.env.LOG_OTP_CODES !== 'false';

export const generateOtpCode = () => String(crypto.randomInt(100000, 1000000));

export const sendOtpSms = async (phone, code, { purpose = 'account_verification', school = null } = {}) => {
  const minutes = Number(process.env.OTP_EXPIRES_MINUTES || 10);
  const res = await deliverSms({
    to: phone,
    text: `Your AwaBus verification code is ${code}. It expires in ${minutes} minutes. Do not share it with anyone.`,
    purpose,
    school,
    secret: true,
  });
  // Not actually sent (no SMS provider yet): keep the code readable in the server
  // log, in the same format as before, so it can still be used while testing.
  // Set LOG_OTP_CODES=false to stop this (e.g. once a provider is live).
  if (res.status === 'logged' && logCodes()) console.log(`[otp] Verification code for ${phone}: ${code}`);
  return res.status !== 'failed';
};

export const sendOtpEmail = async (email, code, { purpose = 'account_verification', school = null } = {}) => {
  const res = await deliverEmail({
    to: email,
    subject: 'Your AwaBus verification code',
    text: `Your AwaBus verification code is ${code}.`,
    purpose,
    school,
    secret: true,
  });
  if (res.status === 'logged' && logCodes()) console.log(`[otp] Verification code for ${email}: ${code}`);
  return res.status !== 'failed';
};

// Generic SMS, used for driver delay broadcasts to parents.
export const sendSms = async (phone, message, { purpose = 'delay_broadcast', school = null } = {}) => {
  const res = await deliverSms({ to: phone, text: message, purpose, school });
  if (res.status === 'failed') throw new Error(res.error || 'SMS failed');
  return true;
};

export const getOtpExpiry = () => {
  const minutes = Number(process.env.OTP_EXPIRES_MINUTES || 10);
  return new Date(Date.now() + minutes * 60 * 1000);
};
