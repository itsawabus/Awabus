/**
 * Starts a call. Never throws: returns { status: 'calling', callId } or
 * { status: 'failed', error } (or 'off' when no provider is switched on).
 * `language` picks the recording (en / tw / ga); blank means English.
 */
export async function placeCall({ to, purpose, language }) {
  const provider = voiceProviderStatus();
  if (!provider.live) return { status: 'off' };
  if (!to) return { status: 'failed', error: 'No phone number' };
  try {
    if (provider.provider === 'mock') return { status: 'calling', callId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    const { callId } = await arkeselCall(to, { language });
    console.log(`[voice] ${purpose} call to ${to} placed (${callId}${language ? `, ${language}` : ''})`);
    return { status: 'calling', callId };
  } catch (err) {
    console.error(`[voice] ${purpose} call failed:`, err.message);
    return { status: 'failed', error: err.message };
  }
}
