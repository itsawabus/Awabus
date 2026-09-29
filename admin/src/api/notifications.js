import apiClient from './client.js';

// params: { status: 'unread', category: 'critical' | 'trips' | 'fleet' | 'account', page, limit }
export const getNotifications = (params) => apiClient.get('/notifications', { params }).then((r) => r.data);
export const getUnreadCount = () => apiClient.get('/notifications/unread-count').then((r) => r.data.data);
export const markNotificationRead = (id) => apiClient.patch(`/notifications/${id}/read`).then((r) => r.data.data);
export const markAllNotificationsRead = () => apiClient.patch('/notifications/read-all').then((r) => r.data.data);
export const getNotificationPreferences = () => apiClient.get('/notifications/preferences').then((r) => r.data.data);
export const updateNotificationPreferences = (muted) =>
  apiClient.put('/notifications/preferences', { muted }).then((r) => r.data.data);
// Deleting hides a notification for this admin only (other admins still see it).
export const deleteNotification = (id) => apiClient.delete(`/notifications/${id}`).then((r) => r.data.data);
// body: { ids: [...] } or { all: true }
export const deleteNotifications = (body) => apiClient.post('/notifications/delete', body).then((r) => r.data);
