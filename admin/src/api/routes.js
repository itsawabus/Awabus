import apiClient from './client.js';

export const getRoutes = (params) => apiClient.get('/routes', { params }).then((r) => r.data);
export const getRoute = (id) => apiClient.get(`/routes/${id}`).then((r) => r.data.data);
export const getRouteOptions = () => apiClient.get('/routes/meta/options').then((r) => r.data.data);
export const createRoute = (payload) => apiClient.post('/routes', payload).then((r) => r.data.data);
export const updateRoute = (id, payload) => apiClient.put(`/routes/${id}`, payload).then((r) => r.data.data);
export const deleteRoute = (id) => apiClient.delete(`/routes/${id}`).then((r) => r.data);
