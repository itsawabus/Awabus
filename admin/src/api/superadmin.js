import apiClient from './client.js';

export const getSuperadminAnalytics = () =>
  apiClient.get('/superadmin/analytics').then((r) => r.data);
export const listSchools = () => apiClient.get('/superadmin/schools').then((r) => r.data);
export const createSchool = (payload) =>
  apiClient.post('/superadmin/schools', payload).then((r) => r.data);
export const createAdminSetupCode = (schoolId) =>
  apiClient.post(`/superadmin/schools/${schoolId}/setup-code`).then((r) => r.data);
export const updateSchoolStatus = (id, status) =>
  apiClient.patch(`/superadmin/schools/${id}/status`, { status }).then((r) => r.data);
// days: 7 | 30 | 90; school: a school id, or omit for the whole platform
export const getPlatformInsights = ({ days, school }) =>
  apiClient.get('/superadmin/insights', { params: { days, school: school || undefined } }).then((r) => r.data.data);
