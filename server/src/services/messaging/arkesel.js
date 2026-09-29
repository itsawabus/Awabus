// Arkesel SMS (https://developers.arkesel.com). Used only when SMS_PROVIDER=arkesel
// and ARKESEL_API_KEY + ARKESEL_SENDER_ID are set. Not yet tested against a live
// Arkesel account: use "Send test SMS" on the System page (with ARKESEL_SANDBOX=true
// first) to confirm before relying on it.
// ARKESEL_BASE_URL is only for pointing at a mock server in tests.
const base = () => process.env.ARKESEL_BASE_URL || 'https://sms.arkesel.com/api/v2';
const TIMEOUT_MS = 10000;

const headers = () => ({ 'api-key': process.env.ARKESEL_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' });

// Arkesel wants Ghana numbers as 233XXXXXXXXX (no plus sign).
const toArkeselNumber = (phone) => String(phone).replace(/[^\d]/g, '').replace(/^0(\d{9})$/, '233$1');

export async function arkeselSend(to, message) {
  const body = {
    sender: process.env.ARKESEL_SENDER_ID,
    message,
    recipients: [toArkeselNumber(to)],
    ...(process.env.ARKESEL_SANDBOX === 'true' ? { sandbox: true } : {}),
  };
  const res = await fetch(`${base()}/sms/send`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status !== 'success') {
    throw new Error(data?.message || `Arkesel responded with HTTP ${res.status}`);
  }
  // The id comes back as data.id (one message) or data[0].id (per recipient).
  const first = Array.isArray(data?.data) ? data.data[0] : data?.data;
  return { providerMessageId: String(first?.id || '') };
}

/** Remaining SMS credit, shown on the System page. */
export async function arkeselBalance() {
  const res = await fetch(`${base()}/clients/balance-details`, { headers: headers(), signal: AbortSignal.timeout(TIMEOUT_MS) });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status !== 'success') throw new Error(data?.message || `Arkesel responded with HTTP ${res.status}`);
  return data.data; // e.g. { sms_balance, main_balance, ... }
}
