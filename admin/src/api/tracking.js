import apiClient from './client.js';

export const getTrackingOverview = () => apiClient.get('/tracking/overview').then((r) => r.data);
export const getTrackingTripDetail = (tripId) =>
  apiClient.get(`/tracking/trips/${tripId}`).then((r) => r.data.data);
// Where the bus has been, and where / when each child was picked up or dropped.
export const getTrackingTrail = (tripId) => apiClient.get(`/tracking/trips/${tripId}/trail`).then((r) => r.data.data);
