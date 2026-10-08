import express from 'express';
import crypto from 'crypto';
import asyncHandler from 'express-async-handler';
import { handleCallResult } from '../services/parentAlerts.js';
import { readWebhook } from '../services/voice/index.js';
import { noteWebhook } from '../services/liveTest.js';

const router = express.Router();

// Only the voice provider knows the token (it is part of the webhook address
// given to it), so nobody else can change a call's result.
const tokenOk = (given) => {
  const wanted = process.env.VOICE_WEBHOOK_TOKEN || '';
  if (!wanted || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(wanted);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// @desc    Call results from the voice provider (ringing, answered, not picked up...)
// @route   POST|GET /api/webhooks/voice/VOICE_WEBHOOK_TOKEN  (or ...?token=VOICE_WEBHOOK_TOKEN)
// Arkesel adds its own query (?campaign_id=...&recipient=...&status=ANSWERED) and
// drops one we send, so the token goes in the path.
router.all(
  '/voice/:token?',
  asyncHandler(async (req, res) => {
    if (!tokenOk(req.params.token || req.query.token || req.get('x-webhook-token'))) {
      console.warn(`[voice] webhook rejected (missing or wrong token): ${req.method} ${req.path} query keys: ${Object.keys(req.query).join(',')}`);
      res.status(404);
      throw new Error('Not found');
    }
    const source = req.method === 'GET' ? req.query : req.body;
    const events = Array.isArray(source) ? source : Array.isArray(source?.data) ? source.data : [source];
    const results = [];
    for (const event of events) {
      // eslint-disable-next-line no-await-in-loop
      const parsed = readWebhook(event);
      // eslint-disable-next-line no-unused-vars
      const { token: _hidden, ...loggable } = event || {};
      console.log(`[voice] webhook received: ${JSON.stringify(loggable).slice(0, 400)}`);
      const result = await handleCallResult({ ...parsed, io: req.app.get('io') });
      noteWebhook({ raw: event, ...parsed, matchedTrip: result.found });
      results.push(result);
    }
    res.json({ success: true, results });
  })
);

export default router;
