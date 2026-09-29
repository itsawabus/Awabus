import apiClient from './client.js';

export const updateProfile = (payload) => apiClient.put('/auth/me', payload).then((r) => r.data.admin);
// purpose: 'change_email' ({ email }) | 'change_phone' ({ phone }) | 'change_password' ({ channel })
export const requestVerification = (payload) => apiClient.post('/auth/me/verification', payload).then((r) => r.data);
export const confirmEmailChange = (code) => apiClient.post('/auth/me/email', { code }).then((r) => r.data.admin);
export const confirmPhoneChange = (code) => apiClient.post('/auth/me/phone', { code }).then((r) => r.data.admin);
export const changePassword = (payload) => apiClient.post('/auth/me/password', payload).then((r) => r.data);
