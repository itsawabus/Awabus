import apiClient from './client.js';

export const getDashboard = () => apiClient.get('/dashboard').then((r) => r.data.data);
