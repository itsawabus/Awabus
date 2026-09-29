// Ghana phone numbers as typed in forms: "0244123456" (10 digits) or
// "244123456" (9 digits, the leading 0 is added for you). The server stores
// them as +233XXXXXXXXX.

/**
 * Keeps digits only: up to 10 when starting with 0 (0551234567), otherwise up
 * to 9 (551234567). A number typed or pasted with the country code
 * (+233 55 123 4567 / 233551234567) becomes 0551234567 once complete.
 */
export function sanitizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('0')) return digits.slice(0, 10);
  // Could still be the country code being typed (233...): allow its 12 digits.
  if (digits.startsWith('233') && digits.length > 9) {
    return digits.length >= 12 ? `0${digits.slice(3, 12)}` : digits;
  }
  return digits.slice(0, 9);
}

/** Adds the missing leading 0 to a complete 9-digit number (done when sending, not in the box). */
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
