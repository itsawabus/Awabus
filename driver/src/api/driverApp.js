import { CODE_LABEL } from '../lib/buildInfo.js';
// Thin wrappers over every /api/driver-app endpoint. See
// server/src/routes/driverAppRoutes.js for the authoritative contract.
import apiClient from './client.js';

// --- Auth --------------------------------------------------------------
export const checkPhone = (phone) =>
  apiClient.post('/driver-app/auth/check-phone', { phone }).then((r) => r.data);

export const setPassword = (phone, password, setupCode) =>
  apiClient.post('/driver-app/auth/set-password', { phone, password, setupCode }).then((r) => r.data);

export const login = (phone, password) =>
  apiClient.post('/driver-app/auth/login', { phone, password }).then((r) => r.data);

export const forgotPassword = (phone) =>
  apiClient.post('/driver-app/auth/forgot-password', { phone }).then((r) => r.data);

export const verifyOtp = (phone, code) =>
  apiClient.post('/driver-app/auth/verify-otp', { phone, code }).then((r) => r.data);

export const resendOtp = (phone) =>
  apiClient.post('/driver-app/auth/resend-otp', { phone }).then((r) => r.data);

// Tells the school the driver signed out, so they show as offline at once.
// Best effort: never blocks or fails the sign-out. The token is passed in
// because it is cleared right after.
export const reportSignOut = (token) =>
  apiClient
    .post('/driver-app/sign-out', null, { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 })
    .catch(() => {});

export const resetPassword = (resetToken, newPassword) =>
  apiClient.post('/driver-app/auth/reset-password', { resetToken, newPassword }).then((r) => r.data);

// --- Profile & trips -----------------------------------------------------
export const getMe = () => apiClient.get('/driver-app/me').then((r) => r.data.data);

// Today's running or next trip; completedToday = trips already finished today.
export const getTodaysTrip = () =>
  apiClient.get('/driver-app/trips/today').then((r) => (r.data.data ? { ...r.data.data, completedToday: r.data.completedToday || 0 } : null));
export const getNotifications = () => apiClient.get('/driver-app/notifications').then((r) => r.data.data);

export const getTripHistory = (params) => apiClient.get('/driver-app/trips', { params }).then((r) => r.data);

export const getTripById = (tripId) => apiClient.get(`/driver-app/trips/${tripId}`).then((r) => r.data.data);

export const startTrip = (tripId) => apiClient.post(`/driver-app/trips/${tripId}/start`).then((r) => r.data.data);

export const endTrip = (tripId) => apiClient.post(`/driver-app/trips/${tripId}/end`).then((r) => r.data.data);

export const pushLocation = (tripId, { lat, lng, heading, recordedAt, accuracy, speed }) =>
  apiClient.post(`/driver-app/trips/${tripId}/location`, { lat, lng, heading, recordedAt, accuracy, speed }).then((r) => r.data.data);

export const markAttendance = (tripId, studentId, { attendance, dropoffStatus }) =>
  apiClient
    .post(`/driver-app/trips/${tripId}/students/${studentId}/attendance`, { attendance, dropoffStatus })
    .then((r) => r.data.data);

export const sendDelayBroadcast = (tripId, { reason, message }) =>
  apiClient.post(`/driver-app/trips/${tripId}/delay-broadcast`, { reason, message }).then((r) => r.data);

export const getBroadcastHistory = () => apiClient.get('/driver-app/broadcasts').then((r) => r.data.data);

// Delete notifications on this driver's list: { ids: [...] } or { all: true }.
// Returns the list that is left.
export const deleteNotifications = (body) =>
  apiClient.post('/driver-app/notifications/delete', body).then((r) => r.data.data);

// Text one student's parent from the bus (through the AwaBus SMS line).
export const sendParentMessage = (tripId, studentId, text) =>
  apiClient.post(`/driver-app/trips/${tripId}/students/${studentId}/message`, { text }).then((r) => r.data);

// Bus assistant (teacher on bus duty) pass for a trip: status, new QR code, stop sharing.
export const getAssistPass = (tripId) => apiClient.get(`/driver-app/trips/${tripId}/assist-pass`).then((r) => r.data.data);
export const createAssistPass = (tripId) => apiClient.post(`/driver-app/trips/${tripId}/assist-pass`).then((r) => r.data.data);
export const stopAssistPass = (tripId) => apiClient.delete(`/driver-app/trips/${tripId}/assist-pass`).then((r) => r.data);

// A crash noted on this phone (src/lib/crashLog.js), for the System page.
export const sendCrashReport = (crash) =>
  apiClient.post('/driver-app/crash-report', { ...crash, code: CODE_LABEL }).then((r) => r.data);

// Students' photos for a trip ({ studentId: photo }), fetched once per trip.
export const getTripPhotos = (tripId) => apiClient.get(`/driver-app/trips/${tripId}/photos`).then((r) => r.data.data || {});
