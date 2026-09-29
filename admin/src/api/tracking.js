import apiClient from './client.js';

export const getTrackingOverview = () => apiClient.get('/tracking/overview').then((r) => r.data);
export const getTrackingTripDetail = (tripId) =>
  apiClient.get(`/tracking/trips/${tripId}`).then((r) => r.data.data);
