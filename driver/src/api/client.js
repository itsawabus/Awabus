import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';
import { useConnectionStore } from '../store/connectionStore.js';

export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'https://awabus.onrender.com/api',
  timeout: 15000,
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

    const noResponse = error?.code === 'ERR_NETWORK' || !error?.response;
    // NetInfo (device-level radio/Wi-Fi state) vs. axios getting no response
    // at all are different failures — a device can have "very good internet"
    // and still fail to reach EXPO_PUBLIC_API_URL (wrong LAN IP, server not
    // running, phone on a different network than the server). Only blame
    // "no internet" when the device itself actually reports being offline.
    const deviceIsOffline = noResponse && !useConnectionStore.getState().isOnline;

    const message =
      error?.response?.data?.message ||
      (deviceIsOffline
        ? 'No internet connection. Check your data or Wi-Fi and try again.'
        : noResponse
          ? "Can't reach the AwaBus server. Check that the server is running and EXPO_PUBLIC_API_URL is set to your computer's address, not localhost."
          : error?.message) ||
      'Something went wrong. Please try again.';
    const wrapped = new Error(message);
    wrapped.isNetworkError = noResponse;
    return Promise.reject(wrapped);
  }
);

export default apiClient;
