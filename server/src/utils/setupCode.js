import crypto from 'crypto';

// One-time setup codes for accounts that have no password yet. Whoever creates
// the account (a school admin for drivers, the platform owner for school
// admins) is shown the code once and hands it over; the new user needs it to
// choose their first password. Knowing someone's email or phone is not enough.

// No 0/O, 1/I/L: easy to read out over the phone.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 8;
export const SETUP_CODE_DAYS = 7;
export const MAX_SETUP_ATTEMPTS = 5;

const normalize = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const hash = (code) => crypto.createHash('sha256').update(normalize(code)).digest('hex');

/** Gives the account a new code (replacing any older one) and returns it as "ABCD-EFGH". */
export function issueSetupCode(account) {
  const code = Array.from({ length: LENGTH }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
  account.setupCodeHash = hash(code);
  account.setupCodeExpires = new Date(Date.now() + SETUP_CODE_DAYS * 24 * 60 * 60 * 1000);
  account.setupCodeAttempts = 0;
  return { setupCode: `${code.slice(0, 4)}-${code.slice(4)}`, setupCodeExpires: account.setupCodeExpires };
}

export function clearSetupCode(account) {
  account.setupCodeHash = undefined;
  account.setupCodeExpires = undefined;
  account.setupCodeAttempts = 0;
}

export const SETUP_CODE_MESSAGES = {
  missing: 'Enter the setup code your school gave you. Ask them for one if you do not have it.',
  expired: 'This setup code has expired. Ask your school for a new one.',
  wrong: 'That setup code is not correct.',
  locked: 'Too many wrong setup codes. Ask your school for a new one.',
};

/**
 * Checks a code typed by the user. Returns 'ok', or why not ('missing' when
 * the account has no code or none was typed, 'expired', 'wrong', 'locked').
 * A wrong guess is counted on the account; the caller must save it.
 */
export function checkSetupCode(account, input) {
  if (!account.setupCodeHash || !normalize(input)) return 'missing';
  if (!account.setupCodeExpires || account.setupCodeExpires < new Date()) return 'expired';
  const a = Buffer.from(account.setupCodeHash, 'hex');
  const b = Buffer.from(hash(input), 'hex');
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return 'ok';
  account.setupCodeAttempts = (account.setupCodeAttempts || 0) + 1;
  if (account.setupCodeAttempts >= MAX_SETUP_ATTEMPTS) {
    clearSetupCode(account);
    return 'locked';
  }
  return 'wrong';
}

// Schema fields shared by Admin and Driver.
export const setupCodeFields = {
  setupCodeHash: { type: String, select: false },
  setupCodeExpires: { type: Date },
  setupCodeAttempts: { type: Number, default: 0, select: false },
};
