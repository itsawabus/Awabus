// Password rules for admin accounts, mirroring server/src/utils/password.js.
export function passwordChecks(password, { email, name } = {}) {
  const pw = password || '';
  const lower = pw.toLowerCase();
  const emailName = String(email || '').split('@')[0].toLowerCase();
  const firstName = String(name || '').split(/\s+/)[0].toLowerCase();
  return [
    { label: 'At least 8 characters', ok: pw.length >= 8 },
    { label: 'Upper and lower case letters', ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { label: 'At least one number', ok: /\d/.test(pw) },
    { label: 'At least one symbol (e.g. ! @ # $)', ok: /[^A-Za-z0-9]/.test(pw) },
    {
      label: 'Does not contain your name or email',
      ok:
        pw.length > 0 &&
        !(emailName.length >= 4 && lower.includes(emailName)) &&
        !(firstName.length >= 4 && lower.includes(firstName)),
    },
  ];
}

export const isStrongPassword = (password, who) => passwordChecks(password, who).every((c) => c.ok);
