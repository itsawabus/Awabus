// Thin wrappers over every /api/driver-app endpoint. See
// server/src/routes/driverAppRoutes.js for the authoritative contract.
import apiClient from './client.js';

// --- Auth --------------------------------------------------------------
export const checkPhone = (phone) =>
  apiClient.post('/driver-app/auth/check-phone', { phone }).then((r) => r.data);

export const setPassword = (phone, password) =>
  apiClient.post('/driver-app/auth/set-password', { phone, password }).then((r) => r.data);

export const login = (phone, password) =>
  apiClient.post('/driver-app/auth/login', { phone, password }).then((r) => r.data);

export const forgotPassword = (phone) =>
  apiClient.post('/driver-app/auth/forgot-password', { phone }).then((r) => r.data);

export const verifyOtp = (phone, code) =>
  apiClient.post('/driver-app/auth/verify-otp', { phone, code }).then((r) => r.data);

export const resendOtp = (phone) =>
  apiClient.post('/driver-app/auth/resend-otp', { phone }).then((r) => r.data);

export const resetPassword = (resetToken, newPassword) =>
  apiClient.post('/driver-app/auth/reset-password', { resetToken, newPassword }).then((r) => r.data);

// --- Profile & trips -----------------------------------------------------
export const getMe = () => apiClient.get('/driver-app/me').then((r) => r.data.data);

export const getTodaysTrip = () => apiClient.get('/driver-app/trips/today').then((r) => r.data.data);

export const getTripHistory = (params) => apiClient.get('/driver-app/trips', { params }).then((r) => r.data);

export const getTripById = (tripId) => apiClient.get(`/driver-app/trips/${tripId}`).then((r) => r.data.data);

export const startTrip = (tripId) => apiClient.post(`/driver-app/trips/${tripId}/start`).then((r) => r.data.data);

export const endTrip = (tripId) => apiClient.post(`/driver-app/trips/${tripId}/end`).then((r) => r.data.data);

export const pushLocation = (tripId, { lat, lng, heading }) =>
  apiClient.post(`/driver-app/trips/${tripId}/location`, { lat, lng, heading }).then((r) => r.data.data);

export const markAttendance = (tripId, studentId, { attendance, dropoffStatus }) =>
  apiClient
    .post(`/driver-app/trips/${tripId}/students/${studentId}/attendance`, { attendance, dropoffStatus })
    .then((r) => r.data.data);

export const sendDelayBroadcast = (tripId, { reason, message }) =>
  apiClient.post(`/driver-app/trips/${tripId}/delay-broadcast`, { reason, message }).then((r) => r.data);

export const getBroadcastHistory = () => apiClient.get('/driver-app/broadcasts').then((r) => r.data.data);
