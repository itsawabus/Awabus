import apiClient from './client.js';

export const checkEmail = (payload) => apiClient.post('/auth/check-email', payload).then((r) => r.data);
export const login = (payload) => apiClient.post('/auth/login', payload).then((r) => r.data);
export const setPassword = (payload) => apiClient.post('/auth/set-password', payload).then((r) => r.data);
export const getMe = () => apiClient.get('/auth/me').then((r) => r.data);
export const forgotPassword = (email) => apiClient.post('/auth/forgot-password', { email }).then((r) => r.data);
export const verifyOtp = (email, code) => apiClient.post('/auth/verify-otp', { email, code }).then((r) => r.data);
export const resendOtp = (email) => apiClient.post('/auth/resend-otp', { email }).then((r) => r.data);
export const resetPassword = (resetToken, newPassword) =>
  apiClient.post('/auth/reset-password', { resetToken, newPassword }).then((r) => r.data);