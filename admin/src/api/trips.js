import apiClient from './client.js';

export const getTrips = (params) => apiClient.get('/trips', { params }).then((r) => r.data);
export const getTrip = (id) => apiClient.get(`/trips/${id}`).then((r) => r.data.data);
