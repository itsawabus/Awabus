import apiClient from './client.js';

export const getSuperadminAnalytics = () =>
  apiClient.get('/superadmin/analytics').then((r) => r.data);
export const listSchools = () => apiClient.get('/superadmin/schools').then((r) => r.data);
export const createSchool = (payload) =>
  apiClient.post('/superadmin/schools', payload).then((r) => r.data);
export const updateSchoolStatus = (id, status) =>
  apiClient.patch(`/superadmin/schools/${id}/status`, { status }).then((r) => r.data);