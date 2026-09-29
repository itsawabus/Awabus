// Languages a parent can choose for automated voice calls (Arkesel voice SMS
// text-to-speech) and the AwaBus phone line (IVR). Arkesel lists English, Twi,
// Ewe and Hausa for text-to-speech; add more here once their voice list
// confirms them. Codes are ISO 639-1. English is the default.
export const VOICE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tw', label: 'Twi' },
  { code: 'ee', label: 'Ewe' },
  { code: 'ha', label: 'Hausa' },
];
export const DEFAULT_LANGUAGE = 'en';
export const LANGUAGE_CODES = VOICE_LANGUAGES.map((l) => l.code);

/** 'tw', 'Twi' or 'twi' -> 'tw'. Blank -> undefined (keep / default). Unknown -> null. */
export function normalizeLanguage(value) {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const v = String(value).trim().toLowerCase();
  const hit = VOICE_LANGUAGES.find((l) => l.code === v || l.label.toLowerCase() === v);
  return hit ? hit.code : null;
}
