// Arkesel voice calls.
//
// IMPORTANT: this was rewritten against a real request example a user pulled
// from their own Arkesel dashboard/support, because the previous version
// (a JSON body with voice_file as a URL) does not match the real API at
// all — Arkesel's voice endpoint wants multipart/form-data with the actual
// audio file uploaded, not a link to one. That example:
//
//   const data = new FormData();
//   data.append('recipients[]', '233544919953');
//   data.append('voice_file', fs.createReadStream('/path/voice_message.mp3'));
//   data.append('voice_id', '0540000000');
//   data.append('retry', 'false');
//   data.append('callback_url', 'https://.../webhook');
//   fetch('https://sms.arkesel.com/api/v2/sms/voice/send', {
//     method: 'POST',
//     headers: { 'api-key': KEY, ...multipart headers },
//     body: data,
//   });
//
// Still NOT CONFIRMED against a live account (ask Arkesel support, then
// delete this paragraph once verified):
//   1. Whether the call-result webhook fires for every state change, or only
//      for non-ANSWERED outcomes — the one example we have says the status
//      "will be returned to the url ... if a status other than ANSWERED is
//      received", which (read literally) means an answered call might never
//      hit our webhook at all. If that's true, ./index.js's webhook-driven
//      call tracking needs a different design — e.g. treat "no webhook
//      within N seconds of placing the call" as answered — since right now
//      it assumes every state (ringing/answered/etc) arrives as a callback.
//   2. The exact audio format/extension Arkesel expects for voice_file (kept
//      as .mp3 here, matching their example, but untested with other
//      formats).
//
// Settings (.env):
//   ARKESEL_API_KEY          same key as SMS
//   ARKESEL_VOICE_FILE_URL   any public URL serving the recorded message
//                            parents hear. We fetch the bytes from here
//                            ourselves and re-upload them to Arkesel on every
//                            call (cached for an hour) — Arkesel's API wants
//                            the file itself, not a link to it.
//   ARKESEL_VOICE_ID         the caller-ID number shown to parents when they
//                            receive the call. In the one real example we
//                            have this is in LOCAL format (0XXXXXXXXX), not
//                            the 233XXXXXXXXX format recipients use — kept
//                            as a separate formatter below rather than
//                            assumed to be the same.
//   ARKESEL_VOICE_URL        optional: the voice-call API address, if not the default below
//   VOICE_WEBHOOK_TOKEN      a long random word; the webhook address given to
//                            Arkesel is https://<server>/api/webhooks/voice?token=<it>
const TIMEOUT_MS = 15000;
const url = () => process.env.ARKESEL_VOICE_URL || 'https://sms.arkesel.com/api/v2/sms/voice/send';

// Arkesel wants recipient numbers as 233XXXXXXXXX (no plus sign).
const toArkeselNumber = (phone) => String(phone).replace(/[^\d]/g, '').replace(/^0(\d{9})$/, '233$1');

// ...but the one real example we have for voice_id uses the local 0-prefixed
// form instead (e.g. 0540000000) — don't assume it takes the same format as
// recipients just because both are Ghana numbers.
const toLocalGhanaNumber = (phone) => {
  const digits = String(phone).replace(/[^\d]/g, '');
  return digits.replace(/^233(\d{9})$/, '0$1');
};

let voiceFileCache = { at: 0, buffer: null, contentType: 'audio/mpeg' };
const VOICE_FILE_CACHE_MS = 60 * 60 * 1000; // re-fetch the hosted file at most once an hour

async function getVoiceFileBytes() {
  const fileUrl = process.env.ARKESEL_VOICE_FILE_URL;
  if (!fileUrl) throw new Error('ARKESEL_VOICE_FILE_URL is not set');
  if (voiceFileCache.buffer && Date.now() - voiceFileCache.at < VOICE_FILE_CACHE_MS) {
    return voiceFileCache;
  }
  const res = await fetch(fileUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Could not fetch the voice message file (HTTP ${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'audio/mpeg';
  voiceFileCache = { at: Date.now(), buffer, contentType };
  return voiceFileCache;
}

export async function arkeselCall(to) {
  const voiceId = process.env.ARKESEL_VOICE_ID;
  if (!voiceId) throw new Error('ARKESEL_VOICE_ID is not set');
  const { buffer, contentType } = await getVoiceFileBytes();

  const form = new FormData();
  form.append('recipients[]', toArkeselNumber(to));
  form.append('voice_file', new Blob([buffer], { type: contentType }), 'voice-message.mp3');
  form.append('voice_id', toLocalGhanaNumber(voiceId));
  form.append('retry', 'false');
  if (process.env.SERVER_PUBLIC_URL && process.env.VOICE_WEBHOOK_TOKEN) {
    form.append(
      'callback_url',
      `${process.env.SERVER_PUBLIC_URL.replace(/\/$/, '')}/api/webhooks/voice?token=${process.env.VOICE_WEBHOOK_TOKEN}`
    );
  }
  // Unconfirmed for voice specifically (same flag name as the SMS sandbox
  // option) — left in since it's harmless if Arkesel ignores it, and useful
  // if it works the same way.
  if (process.env.ARKESEL_SANDBOX === 'true') form.append('sandbox', 'true');

  const res = await fetch(url(), {
    method: 'POST',
    // Do not set Content-Type manually — fetch computes the multipart
    // boundary itself from the FormData body.
    headers: { 'api-key': process.env.ARKESEL_API_KEY },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || (data?.status && data.status !== 'success')) {
    throw new Error(data?.message || `Arkesel responded with HTTP ${res.status}`);
  }
  const first = Array.isArray(data?.data) ? data.data[0] : data?.data;
  const callId = String(first?.id || first?.call_id || data?.id || '');
  if (!callId) throw new Error('Arkesel did not return a call id');
  return { callId };
}
