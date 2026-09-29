import apiClient from './client.js';

export const getBuses = (params) => apiClient.get('/buses', { params }).then((r) => r.data);
export const getBus = (id) => apiClient.get(`/buses/${id}`).then((r) => r.data);
export const getBusOptions = () => apiClient.get('/buses/meta/options').then((r) => r.data.data);
export const createBus = (payload) => apiClient.post('/buses', payload).then((r) => r.data.data);
export const updateBus = (id, payload) => apiClient.put(`/buses/${id}`, payload).then((r) => r.data.data);
export const deleteBus = (id) => apiClient.delete(`/buses/${id}`).then((r) => r.data);
