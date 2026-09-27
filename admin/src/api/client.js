import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://awabus.onrender.com/api',
});

apiClient.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Bearer ${token}`;
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
