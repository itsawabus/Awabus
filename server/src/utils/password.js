// Minimum password rules for admin accounts. Returns an error message, or null
// when the password is acceptable. Mirrored in admin/src/lib/password.js.
export function checkPasswordStrength(password, { email, name } = {}) {
  const pw = String(password || '');
  if (pw.length < 8) return 'Password must be at least 8 characters long';
  if (pw.length > 128) return 'Password must be at most 128 characters long';
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) return 'Password must contain both upper and lower case letters';
  if (!/\d/.test(pw)) return 'Password must contain at least one number';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain at least one symbol (e.g. ! @ # $)';
  const lower = pw.toLowerCase();
  const emailName = String(email || '').split('@')[0].toLowerCase();
  if (emailName.length >= 4 && lower.includes(emailName)) return 'Password must not contain your email address';
  const firstName = String(name || '').split(/\s+/)[0].toLowerCase();
  if (firstName.length >= 4 && lower.includes(firstName)) return 'Password must not contain your name';
  return null;
}
