// Arkesel voice calls. NOT YET CHECKED AGAINST A LIVE ARKESEL ACCOUNT: when the
// Arkesel voice service is set up, confirm the address, the field names and
// the webhook body against Arkesel's documentation, and adjust here (and in
// readWebhook / normalizeCallStatus in ./index.js) if they differ.
//
// Settings (.env):
//   ARKESEL_API_KEY          same key as SMS
//   ARKESEL_VOICE_FILE_URL   the recorded message parents hear (an audio file
//                            address, e.g. "The school bus is almost at your home")
//   ARKESEL_VOICE_URL        optional: the voice-call API address, if not the default below
//   VOICE_WEBHOOK_TOKEN      a long random word; the webhook address given to
//                            Arkesel is https://<server>/api/webhooks/voice?token=<it>
const TIMEOUT_MS = 10000;
const url = () => process.env.ARKESEL_VOICE_URL || 'https://sms.arkesel.com/api/v2/sms/voice/send';

// Arkesel wants Ghana numbers as 233XXXXXXXXX (no plus sign).
const toArkeselNumber = (phone) => String(phone).replace(/[^\d]/g, '').replace(/^0(\d{9})$/, '233$1');

export async function arkeselCall(to) {
  const body = {
    recipients: [toArkeselNumber(to)],
    voice_file: process.env.ARKESEL_VOICE_FILE_URL,
    ...(process.env.ARKESEL_SENDER_ID ? { sender: process.env.ARKESEL_SENDER_ID } : {}),
    ...(process.env.SERVER_PUBLIC_URL && process.env.VOICE_WEBHOOK_TOKEN
      ? { callback_url: `${process.env.SERVER_PUBLIC_URL.replace(/\/$/, '')}/api/webhooks/voice?token=${process.env.VOICE_WEBHOOK_TOKEN}` }
      : {}),
    ...(process.env.ARKESEL_SANDBOX === 'true' ? { sandbox: true } : {}),
  };
  const res = await fetch(url(), {
    method: 'POST',
    headers: { 'api-key': process.env.ARKESEL_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
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
