import apiClient from './client.js';

// The signed-in admin's school (or the school a superadmin is viewing).
export const getMySchool = () => apiClient.get('/school').then((r) => r.data.data);
export const updateSchoolLocation = (body) => apiClient.put('/school/location', body).then((r) => r.data.data);
