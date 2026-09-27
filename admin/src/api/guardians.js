import apiClient from './client.js';

export const getGuardians = (params) => apiClient.get('/guardians', { params }).then((r) => r.data.data);
export const createGuardian = (payload) => apiClient.post('/guardians', payload).then((r) => r.data.data);
export const updateGuardian = (id, payload) => apiClient.put(`/guardians/${id}`, payload).then((r) => r.data.data);
