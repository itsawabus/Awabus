import apiClient from './client.js';

// Developer tools for the superadmin System page.
export const getSystemHealth = () => apiClient.get('/superadmin/system/health').then((r) => r.data.data);
export const getMessageLog = (params) => apiClient.get('/superadmin/system/messages', { params }).then((r) => r.data);
export const sendTestSms = (payload) => apiClient.post('/superadmin/system/messages/test', payload).then((r) => r.data.data);
export const getServerErrors = () => apiClient.get('/superadmin/system/errors').then((r) => r.data.data);
export const clearServerErrors = () => apiClient.delete('/superadmin/system/errors').then((r) => r.data);

// Live test: fire SMS / calls to a few numbers at an interval (System > Messaging).
export const getLiveTest = () => apiClient.get('/superadmin/system/live-test').then((r) => r.data.data);
export const startLiveTest = (payload) => apiClient.post('/superadmin/system/live-test', payload).then((r) => r.data.data);
export const stopLiveTest = () => apiClient.delete('/superadmin/system/live-test').then((r) => r.data.data);
