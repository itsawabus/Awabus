// Arkesel voice calls.
//
// Arkesel's voice endpoint wants multipart/form-data with the actual audio file
// uploaded (not a link to one):
//
//   POST https://sms.arkesel.com/api/v2/sms/voice/send
//   recipients[] = 233XXXXXXXXX, voice_file = <audio bytes>,
//   voice_id = 0XXXXXXXXX (caller-ID, local format), retry, callback_url
//
// Still NOT CONFIRMED against a live account (ask Arkesel support):
//   1. Whether the call-result webhook fires for every state change or only for
//      non-ANSWERED outcomes.
//   2. Audio formats other than a real MP3 (a 3GPP file renamed .mp3 is rejected).
//
// Settings (.env):
//   ARKESEL_API_KEY            same key as SMS
//   ARKESEL_VOICE_FILE_URL     the DEFAULT (English) recording. We fetch the
//                              bytes ourselves and re-upload them on every call
//                              (cached for an hour). Also the fallback when a
//                              language's own recording cannot be loaded.
//   ARKESEL_VOICE_FILE_URL_EN / _TW / _GA
//                              optional: a different address for one language.
//                              Without these, Twi and Ga are read from
//                              <SERVER_PUBLIC_URL>/voice/school-bus-tw.mp3 and
//                              school-bus-ga.mp3 (the files in server/public/voice).
//   ARKESEL_VOICE_ID           caller-ID number shown to parents (local format)
//   ARKESEL_VOICE_URL          optional: the voice-call API address, if not the default below
//   VOICE_WEBHOOK_TOKEN        long random word; the result address given to Arkesel is
//                              https://<server>/api/webhooks/voice/<it>
import { phoneKey } from './phoneKey.js';
import { DEFAULT_LANGUAGE } from '../../utils/languages.js';

const TIMEOUT_MS = 15000;
const url = () => process.env.ARKESEL_VOICE_URL || 'https://sms.arkesel.com/api/v2/sms/voice/send';

// Arkesel wants recipient numbers as 233XXXXXXXXX (no plus sign).
const toArkeselNumber = (phone) => String(phone).replace(/[^\d]/g, '').replace(/^0(\d{9})$/, '233$1');

// ...but voice_id takes the local 0-prefixed form (e.g. 0596921073).
const toLocalGhanaNumber = (phone) => {
  const digits = String(phone).replace(/[^\d]/g, '');
  return digits.replace(/^233(\d{9})$/, '0$1');
};

const VOICE_FILE_CACHE_MS = 60 * 60 * 1000; // re-fetch a hosted file at most once an hour
const voiceFileCache = new Map(); // file address -> { at, buffer, contentType }

/**
 * Where to look for the recording of a language, best first:
 *   1. ARKESEL_VOICE_FILE_URL_<CODE> (e.g. _TW, _GA)
 *   2. this server's own /voice/school-bus-<code>.mp3 (not for English)
 *   3. ARKESEL_VOICE_FILE_URL, the default (English) recording
 */
export function voiceFileUrls(language) {
  const code = String(language || DEFAULT_LANGUAGE).toLowerCase();
  const urls = [];
  const own = process.env[`ARKESEL_VOICE_FILE_URL_${code.toUpperCase()}`];
  if (own) urls.push(own);
  if (code !== DEFAULT_LANGUAGE && process.env.SERVER_PUBLIC_URL) {
    urls.push(`${process.env.SERVER_PUBLIC_URL.replace(/\/$/, '')}/voice/school-bus-${code}.mp3`);
  }
  if (process.env.ARKESEL_VOICE_FILE_URL) urls.push(process.env.ARKESEL_VOICE_FILE_URL);
  return [...new Set(urls)];
}

async function fetchVoiceFile(fileUrl) {
  const cached = voiceFileCache.get(fileUrl);
  if (cached && Date.now() - cached.at < VOICE_FILE_CACHE_MS) return cached;
  const res = await fetch(fileUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Could not fetch the voice message file (HTTP ${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  // Arkesel checks the real file type, not the name. A phone recording (3GPP/MP4)
  // renamed to .mp3 is rejected with "The voice file must be a file of type: ...".
  if (buffer.length < 100) throw new Error('The voice message file is empty or too small');
  if (buffer.subarray(4, 10).toString('latin1') === 'ftyp3g') {
    throw new Error('The voice message file is a 3GPP phone recording renamed to .mp3. Convert it to a real MP3 (or WAV) and upload it again');
  }
  const entry = { at: Date.now(), buffer, contentType: res.headers.get('content-type') || 'audio/mpeg' };
  voiceFileCache.set(fileUrl, entry);
  return entry;
}

// The recording for a language. If its own file cannot be loaded, the next
// choice is tried, ending with the default recording, so a missing translation
// never stops a call from being placed.
async function getVoiceFileBytes(language) {
  const urls = voiceFileUrls(language);
  if (!urls.length) throw new Error('ARKESEL_VOICE_FILE_URL is not set');
  let lastError;
  for (const [i, fileUrl] of urls.entries()) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fetchVoiceFile(fileUrl);
    } catch (err) {
      lastError = err;
      console.warn(`[voice] ${language || DEFAULT_LANGUAGE} recording ${fileUrl} not usable: ${err.message}${i < urls.length - 1 ? ' - trying the next one' : ''}`);
    }
  }
  throw lastError;
}

export async function arkeselCall(to, { language } = {}) {
  const voiceId = process.env.ARKESEL_VOICE_ID;
  if (!voiceId) throw new Error('ARKESEL_VOICE_ID is not set');
  const { buffer, contentType } = await getVoiceFileBytes(language);

  const form = new FormData();
  form.append('recipients[]', toArkeselNumber(to));
  form.append('voice_file', new Blob([buffer], { type: contentType }), 'voice-message.mp3');
  form.append('voice_id', toLocalGhanaNumber(voiceId));
  form.append('retry', 'false');
  if (process.env.SERVER_PUBLIC_URL && process.env.VOICE_WEBHOOK_TOKEN) {
    form.append(
      'callback_url',
      `${process.env.SERVER_PUBLIC_URL.replace(/\/$/, '')}/api/webhooks/voice/${process.env.VOICE_WEBHOOK_TOKEN}`
    );
  }
  // Unconfirmed for voice specifically (same flag name as the SMS sandbox option).
  if (process.env.ARKESEL_SANDBOX === 'true') form.append('sandbox', 'true');

  const res = await fetch(url(), {
    method: 'POST',
    // Do not set Content-Type manually: fetch computes the multipart boundary.
    headers: { 'api-key': process.env.ARKESEL_API_KEY },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text().catch(() => '');
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* not JSON: logged below */
  }
  console.log(`[voice] Arkesel replied HTTP ${res.status}: ${text.slice(0, 400)}`);
  if (!res.ok || (data?.status && data.status !== 'success')) {
    throw new Error(data?.message || `Arkesel responded with HTTP ${res.status}`);
  }
  const first = Array.isArray(data?.data) ? data.data[0] : data?.data;
  // Arkesel names the call a "campaign"; its result report carries the same id.
  // If the reply has no usable id, the call is matched by the recipient's number.
  const callId = String(first?.id || first?.call_id || first?.campaign_id || data?.campaign_id || data?.id || '') || phoneKey(to);
  if (!callId) throw new Error('Arkesel did not return a call id');
  return { callId };
}
