import axios from 'axios';
import { useAuthStore, signInLapsed } from '../store/authStore.js';
import { useViewSchoolStore } from '../store/viewSchoolStore.js';

// Where the API is. Without admin/.env, the dev server (npm run dev, e.g. in a
// Codespace) uses its own /api, which Vite forwards to the server on port
// 5000 - the same server the driver app is pointed at with api:codespace. Only
// a production build falls back to the deployed server.
export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://awabus.onrender.com/api');

export const apiClient = axios.create({ baseURL: API_URL });

apiClient.interceptors.request.use((config) => {
  // Not remembered and past its time (tab left open): sign out instead of sending.
  if (useAuthStore.getState().token && signInLapsed()) useAuthStore.getState().logout();
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
    // The school was suspended (or similar): sign out and say why on the sign-in page.
    if (error?.response?.status === 403 && error?.response?.data?.code === 'SCHOOL_SUSPENDED') {
      try {
        sessionStorage.setItem('awabus_signout_reason', error.response.data.message);
      } catch {
        /* storage unavailable */
      }
      if (useAuthStore.getState().token) useAuthStore.getState().logout();
    }
    const message =
      error?.response?.data?.message || error?.message || 'Something went wrong. Please try again.';
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
