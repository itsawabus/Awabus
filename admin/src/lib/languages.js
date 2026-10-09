// Languages a parent can choose for automated voice calls and the AwaBus phone
// line. Must match server/src/utils/languages.js. English is the default.
export const VOICE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tw', label: 'Twi' },
  { code: 'ga', label: 'Ga' },
];
export const DEFAULT_LANGUAGE = 'en';
export const languageLabel = (code) => (VOICE_LANGUAGES.find((l) => l.code === code) || VOICE_LANGUAGES[0]).label;
