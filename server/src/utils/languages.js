// Languages a parent can choose for automated voice calls and the AwaBus phone
// line (IVR). Each language has its own recorded message (see
// services/voice/arkeselVoice.js). English is the default.
//
// "ga" is our own code for Ga (it has no ISO 639-1 code). It is only used
// inside AwaBus: in the database, the forms, and the recording file names
// (school-bus-ga.mp3, ARKESEL_VOICE_FILE_URL_GA).
export const VOICE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tw', label: 'Twi' },
  { code: 'ga', label: 'Ga' },
];
export const DEFAULT_LANGUAGE = 'en';

// Ewe and Hausa were offered before and may be saved on some parents. They are
// no longer choices; those parents are treated as English.
const LEGACY_CODES = ['ee', 'ha'];

// Every code that may be stored (used by the Guardian model's enum).
export const LANGUAGE_CODES = [...VOICE_LANGUAGES.map((l) => l.code), ...LEGACY_CODES];

/** 'tw', 'Twi' or 'twi' -> 'tw'. Blank -> undefined (keep / default). Unknown -> null. */
export function normalizeLanguage(value) {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const v = String(value).trim().toLowerCase();
  if (LEGACY_CODES.includes(v) || v === 'ewe' || v === 'hausa') return DEFAULT_LANGUAGE;
  const hit = VOICE_LANGUAGES.find((l) => l.code === v || l.label.toLowerCase() === v);
  return hit ? hit.code : null;
}
