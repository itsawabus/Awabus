import apiClient from './client.js';

export const getStudents = (params) => apiClient.get('/students', { params }).then((r) => r.data);
export const getStudent = (id) => apiClient.get(`/students/${id}`).then((r) => r.data.data);
export const getStudentOptions = (params) => apiClient.get('/students/meta/options', { params }).then((r) => r.data.data);
export const createStudent = (payload) => apiClient.post('/students', payload).then((r) => r.data.data);
export const updateStudent = (id, payload) => apiClient.put(`/students/${id}`, payload).then((r) => r.data.data);
export const deleteStudent = (id) => apiClient.delete(`/students/${id}`).then((r) => r.data);

// Ride cancellations (parents by phone, or the office). choice: 'morning' | 'evening' | 'both'
export const getRideCancellations = (id) => apiClient.get(`/students/${id}/ride-cancellations`).then((r) => r.data.data);
export const cancelRide = (id, choice) => apiClient.post(`/students/${id}/ride-cancellations`, { choice }).then((r) => r.data);
export const undoRideCancellation = (id, cancellationId) =>
  apiClient.delete(`/students/${id}/ride-cancellations/${cancellationId}`).then((r) => r.data.data);
