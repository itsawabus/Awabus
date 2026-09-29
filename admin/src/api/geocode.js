import apiClient from './client.js';

export const lookupGhanaPostGps = (address) =>
  apiClient.get('/geocode/ghanapost', { params: { address } }).then((r) => r.data.data);
