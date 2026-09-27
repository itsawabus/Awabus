import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import Admin from '../models/Admin.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES,
  cleanMutedTypes,
} from '../services/notificationTypes.js';

// Superadmins sit above all schools and have no school notifications (yet).
const isPlatformAdmin = (req) => req.admin?.role === 'superadmin';

// What this admin wants to see: every type except the ones they muted.
const visibleFilter = (req) => {
  const muted = cleanMutedTypes(req.admin.mutedNotifications);
  return muted.length ? { type: { $nin: muted } } : {};
};

const unreadFilter = (req) => ({ ...visibleFilter(req), readBy: { $ne: req.admin._id } });

const present = (req) => (n) => ({
  _id: n._id,
  type: n.type,
  category: n.category,
  severity: n.severity,
  title: n.title,
  message: n.message,
  link: n.link,
  createdAt: n.createdAt,
  read: (n.readBy || []).some((id) => String(id) === String(req.admin._id)),
});

const counts = async (req) => {
  const [unread, critical] = await Promise.all([
    Notification.countDocuments(unreadFilter(req)),
    Notification.countDocuments({ ...unreadFilter(req), severity: 'critical' }),
  ]);
  return { unread, critical };
};

// @desc    List notifications, newest first
// @route   GET /api/notifications?status=unread&category=trips&page=1&limit=20
export const getNotifications = asyncHandler(async (req, res) => {
  const { page } = getPagination(req.query, 20);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50); // capped page size
  if (isPlatformAdmin(req)) {
    return res.json({ success: true, data: [], meta: buildPaginationMeta(0, page, limit), counts: { unread: 0, critical: 0 } });
  }

  const filter = req.query.status === 'unread' ? unreadFilter(req) : visibleFilter(req);
  if (NOTIFICATION_CATEGORIES.some((c) => c.key === req.query.category)) filter.category = req.query.category;

  const [items, total, c] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
    counts(req),
  ]);
  res.json({ success: true, data: items.map(present(req)), meta: buildPaginationMeta(total, page, limit), counts: c });
});

// @desc    Unread counts for the top-bar bell
// @route   GET /api/notifications/unread-count
export const getUnreadCount = asyncHandler(async (req, res) => {
  if (isPlatformAdmin(req)) return res.json({ success: true, data: { unread: 0, critical: 0 } });
  res.json({ success: true, data: await counts(req) });
});

// @desc    Mark one notification as read
// @route   PATCH /api/notifications/:id/read
export const markRead = asyncHandler(async (req, res) => {
  if (isPlatformAdmin(req) || !mongoose.isValidObjectId(req.params.id)) {
    res.status(404);
    throw new Error('Notification not found');
  }
  const result = await Notification.updateOne({ _id: req.params.id }, { $addToSet: { readBy: req.admin._id } });
  if (!result.matchedCount) {
    res.status(404);
    throw new Error('Notification not found');
  }
  res.json({ success: true, data: await counts(req) });
});

// @desc    Mark every notification as read
// @route   PATCH /api/notifications/read-all
export const markAllRead = asyncHandler(async (req, res) => {
  if (!isPlatformAdmin(req)) {
    await Notification.updateMany({ readBy: { $ne: req.admin._id } }, { $addToSet: { readBy: req.admin._id } });
  }
  res.json({ success: true, data: { unread: 0, critical: 0 } });
});

const preferencesFor = (admin) => {
  const muted = cleanMutedTypes(admin.mutedNotifications);
  return {
    categories: NOTIFICATION_CATEGORIES,
    types: Object.entries(NOTIFICATION_TYPES).map(([key, t]) => ({
      key,
      category: t.category,
      label: t.label,
      description: t.description,
      enabled: !muted.includes(key),
    })),
  };
};

// @desc    Which notification types this admin receives
// @route   GET /api/notifications/preferences
export const getPreferences = asyncHandler(async (req, res) => {
  res.json({ success: true, data: preferencesFor(req.admin) });
});

// @desc    Switch notification types on or off   body: { muted: ['trip_started', ...] }
// @route   PUT /api/notifications/preferences
export const updatePreferences = asyncHandler(async (req, res) => {
  if (!Array.isArray(req.body?.muted)) {
    res.status(400);
    throw new Error('Send the list of notification types to switch off');
  }
  const admin = await Admin.findById(req.admin._id);
  admin.mutedNotifications = cleanMutedTypes(req.body.muted);
  await admin.save();
  res.json({ success: true, data: preferencesFor(admin) });
});
