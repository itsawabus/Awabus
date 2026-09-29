import express from 'express';
import {
  requireAssistPass,
  getAssistTrip,
  assistMarkAttendance,
  assistMessageParent,
  assistDelayBroadcast,
  assistPushLocation,
  getAssistPhotos,
  assistStopLocation,
} from '../controllers/assistController.js';

// Bus assistant page (no account; the pass from the driver's QR code).
const router = express.Router();

router.use(requireAssistPass);
router.get('/trip', getAssistTrip);
router.post('/students/:studentId/attendance', assistMarkAttendance);
router.post('/students/:studentId/message', assistMessageParent);
router.post('/delay-broadcast', assistDelayBroadcast);
router.post('/location', assistPushLocation);
router.delete('/location', assistStopLocation);
router.get('/photos', getAssistPhotos);

export default router;
