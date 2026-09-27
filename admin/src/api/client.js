import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';
import { useViewSchoolStore } from '../store/viewSchoolStore.js';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://awabus.onrender.com/api',
});

apiClient.interceptors.request.use((config) => {
  const { token, admin } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // A superadmin sees one chosen school at a time on the school pages.
  const viewing = useViewSchoolStore.getState().school;
  if (admin?.role === 'superadmin' && viewing) config.headers['X-View-School'] = viewing.id;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    const message =
      error?.response?.data?.message || error?.message || 'Something went wrong. Please try again.';
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
