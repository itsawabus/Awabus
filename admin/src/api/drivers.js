import apiClient from './client.js';

export const getDrivers = (params) => apiClient.get('/drivers', { params }).then((r) => r.data);
export const getDriver = (id) => apiClient.get(`/drivers/${id}`).then((r) => r.data.data);
export const getDriverOptions = (params) => apiClient.get('/drivers/meta/options', { params }).then((r) => r.data.data);
export const validateLicense = (payload) =>
  apiClient.post('/drivers/validate-license', payload).then((r) => r.data);
export const createDriver = (payload) => apiClient.post('/drivers', payload).then((r) => r.data.data);
export const updateDriver = (id, payload) => apiClient.put(`/drivers/${id}`, payload).then((r) => r.data.data);
export const deleteDriver = (id) => apiClient.delete(`/drivers/${id}`).then((r) => r.data);
