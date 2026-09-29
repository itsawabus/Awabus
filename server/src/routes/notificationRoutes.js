import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteNotifications,
  deleteNotification,
  getPreferences,
  updatePreferences,
} from '../controllers/notificationController.js';
import { protectAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(protectAdmin);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.route('/preferences').get(getPreferences).put(updatePreferences);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);
router.post('/delete', deleteNotifications);
router.delete('/:id', deleteNotification);

export default router;
