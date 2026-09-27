import crypto from 'node:crypto';

// OTP generation + mock "SMS" delivery.
// There is no SMS gateway wired up yet, so in development the code is written
// to the server console/log instead of being texted to the phone.

export const generateOtpCode = () => String(crypto.randomInt(100000, 1000000));

export const sendOtpSms = async (phone, code) => {
  // TODO: integrate a real SMS gateway (e.g. Twilio, Hubtel, Arkesel) here.
  console.log(`[otp] Verification code for ${phone}: ${code}`);
  return true;
};

// Same placeholder for email: no mail provider is configured yet, so the code
// is written to the server log.
export const sendOtpEmail = async (email, code) => {
  // TODO: integrate a real email provider (e.g. SendGrid, Mailgun, SES) here.
  console.log(`[otp] Verification code for ${email}: ${code}`);
  return true;
};

// Generic SMS send, used for driver delay broadcasts to parents.
// Same "log instead of send" placeholder as sendOtpSms until a real
// gateway is wired up.
export const sendSms = async (phone, message) => {
  console.log(`[sms] To ${phone}: ${message}`);
  return true;
};

export const getOtpExpiry = () => {
  const minutes = Number(process.env.OTP_EXPIRES_MINUTES || 10);
  return new Date(Date.now() + minutes * 60 * 1000);
};
