// Developer "live test": fires SMS and/or arrival calls to a few numbers at a
// fixed interval, so Arkesel can be tested without a bus on a trip. Superadmin
// only (System page > Messaging). It runs in this server's memory: one test at
// a time, hard limits on numbers / rounds / speed (every message is paid), and
// it stops by itself. A server restart ends it.
//
// It also keeps the last webhook deliveries Arkesel sent (real trips and
// tests), so you can see exactly what Arkesel reports for a call.
import { randomUUID } from 'node:crypto';
import { sendSms } from './messaging/index.js';
import { phoneKey } from './voice/phoneKey.js';
import { placeCall, normalizeCallStatus, callMovesTo, CALL_LABELS } from './voice/index.js';

export const LIVE_TEST_LIMITS = { maxNumbers: 3, minIntervalSeconds: 30, maxIntervalSeconds: 3600, maxRounds: 10 };
const MAX_EVENTS = 100;
const MAX_WEBHOOKS = 25;

let run = null; // the current or last test
let timer = null;
const webhooks = [];
const callIndex = new Map(); // callId -> event, to attach call results to test calls

const now = () => new Date().toISOString();

function pushEvent(event) {
  const e = { id: randomUUID(), at: now(), ...event };
  run.events.unshift(e);
  if (run.events.length > MAX_EVENTS) run.events.length = MAX_EVENTS;
  return e;
}

async function fire(to, kind, text) {
  if (kind === 'sms') {
    const r = await sendSms({ to, text, purpose: 'test' });
    pushEvent({ to, kind: 'sms', status: r.status, detail: r.error || (r.status === 'logged' ? 'No SMS provider is on' : '') });
    return;
  }
  const r = await placeCall({ to, purpose: 'live_test' });
  const e = pushEvent({
    to,
    kind: 'call',
    status: r.status === 'calling' ? 'calling' : r.status === 'off' ? 'not placed' : 'failed',
    callId: r.callId || '',
    detail: r.status === 'off' ? 'No voice provider is on' : r.error || '',
  });
  if (r.callId) callIndex.set(r.callId, e);
}

async function tick() {
  if (!run || run.state !== 'running') return;
  run.round += 1;
  for (const to of run.numbers) {
    for (const kind of run.mode === 'both' ? ['sms', 'call'] : [run.mode]) {
      if (run.state !== 'running') return;
      // eslint-disable-next-line no-await-in-loop
      await fire(to, kind, run.text).catch((err) => pushEvent({ to, kind, status: 'failed', detail: err.message }));
    }
  }
  if (run.round >= run.rounds) {
    run.state = 'finished';
    run.finishedAt = now();
    run.nextAt = null;
    return;
  }
  run.nextAt = new Date(Date.now() + run.intervalSeconds * 1000).toISOString();
  timer = setTimeout(tick, run.intervalSeconds * 1000);
}

export function startLiveTest({ numbers, mode, intervalSeconds, rounds, text }) {
  if (run?.state === 'running') throw new Error('A test is already running. Stop it first.');
  const L = LIVE_TEST_LIMITS;
  if (!numbers.length || numbers.length > L.maxNumbers) throw new Error(`Give 1 to ${L.maxNumbers} phone numbers.`);
  if (!['sms', 'call', 'both'].includes(mode)) throw new Error('Choose SMS, call or both.');
  if (!(intervalSeconds >= L.minIntervalSeconds && intervalSeconds <= L.maxIntervalSeconds)) {
    throw new Error(`Interval must be between ${L.minIntervalSeconds} and ${L.maxIntervalSeconds} seconds.`);
  }
  if (!(rounds >= 1 && rounds <= L.maxRounds)) throw new Error(`Rounds must be between 1 and ${L.maxRounds}.`);
  clearTimeout(timer);
  run = {
    id: randomUUID(),
    state: 'running',
    numbers,
    mode,
    intervalSeconds,
    rounds,
    round: 0,
    text: text || 'AwaBus live test: the school bus is almost at your home.',
    startedAt: now(),
    finishedAt: null,
    nextAt: now(),
    events: [],
  };
  callIndex.clear();
  timer = setTimeout(tick, 0);
  return liveTestStatus();
}

export function stopLiveTest() {
  clearTimeout(timer);
  if (run?.state === 'running') {
    run.state = 'stopped';
    run.finishedAt = now();
    run.nextAt = null;
  }
  return liveTestStatus();
}

export const liveTestStatus = () => ({ limits: LIVE_TEST_LIMITS, run, webhooks });

/**
 * Every call-result webhook Arkesel sends is kept here (what it said, and what
 * we made of it). If the call belongs to a live test, the test row is updated.
 */
export function noteWebhook({ raw, callId, recipient, status, seconds, matchedTrip }) {
  const normalized = normalizeCallStatus(status, seconds);
  webhooks.unshift({ at: now(), callId, status: String(status || ''), seconds, normalized, matchedTrip: Boolean(matchedTrip), raw: JSON.stringify(raw || {}).slice(0, 500) });
  if (webhooks.length > MAX_WEBHOOKS) webhooks.length = MAX_WEBHOOKS;
  const e = callIndex.get(callId) || callIndex.get(phoneKey(recipient));
  if (e && normalized && callMovesTo(e.callState, normalized)) {
    e.callState = normalized;
    e.status = CALL_LABELS[normalized] || normalized;
    e.updatedAt = now();
  }
}
