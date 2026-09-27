// Ghana phone numbers as typed in forms: "0244123456" (10 digits) or
// "244123456" (9 digits, the leading 0 is added for you). The server stores
// them as +233XXXXXXXXX.

/** Keeps digits only, capped at 10 when starting with 0 and 9 otherwise. */
export function sanitizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  // Pasted international formats: +233 24 412 3456 / 233244123456
  if (digits.startsWith('233') && digits.length > 10) digits = `0${digits.slice(3)}`;
  return digits.slice(0, digits.startsWith('0') ? 10 : 9);
}

/** Adds the missing leading 0 to a complete 9-digit number. */
export const toLocalPhone = (value) => {
  const digits = sanitizePhone(value);
  return digits.length === 9 && !digits.startsWith('0') ? `0${digits}` : digits;
};

export const isValidPhone = (value) => /^0\d{9}$/.test(toLocalPhone(value));

/** Converts a stored number (+233244123456, 0244123456, ...) to the form's 0XXXXXXXXX. */
export const fromStoredPhone = (stored) => (stored ? toLocalPhone(stored) : '');

/** 0244123456 -> 024 412 3456, for display. */
export const formatPhone = (value) => {
  const local = toLocalPhone(value);
  return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : value || '';
};
