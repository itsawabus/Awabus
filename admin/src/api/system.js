import apiClient from './client.js';

// Developer tools for the superadmin System page.
export const getSystemHealth = () => apiClient.get('/superadmin/system/health').then((r) => r.data.data);
export const getMessageLog = (params) => apiClient.get('/superadmin/system/messages', { params }).then((r) => r.data);
export const sendTestSms = (payload) => apiClient.post('/superadmin/system/messages/test', payload).then((r) => r.data.data);
export const getServerErrors = () => apiClient.get('/superadmin/system/errors').then((r) => r.data.data);
export const clearServerErrors = () => apiClient.delete('/superadmin/system/errors').then((r) => r.data);
