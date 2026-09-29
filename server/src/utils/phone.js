// Ghana phone numbers are stored as +233 followed by the 9-digit local number.
// Accepts "0248250754", "248250754", "233248250754", "+233 24 825 0754" and the
// mistaken "+2330248250754"; anything else is returned trimmed and unchanged.
export function normalizeGhanaPhone(input) {
  if (input == null) return input;
  const raw = String(input).trim();
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233')) digits = digits.slice(3);
  if (digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.length === 9 ? `+233${digits}` : raw;
}

// Forms a phone number may have been stored in before normalization existed.
export function ghanaPhoneVariants(input) {
  const normalized = normalizeGhanaPhone(input);
  if (!/^\+233\d{9}$/.test(normalized)) return [normalized];
  const local = normalized.slice(4);
  return [normalized, `0${local}`, local, `+2330${local}`, `233${local}`];
}

export const isValidGhanaPhone = (input) => /^\+233\d{9}$/.test(normalizeGhanaPhone(input) || '');
