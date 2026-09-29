import axios from 'axios';
import { API_URL } from '../lib/buildInfo.js';
import { useAuthStore } from '../store/authStore.js';
import { useConnectionStore } from '../store/connectionStore.js';

export const apiClient = axios.create({
  baseURL: API_URL,
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
    // Our server's 401 (session over) signs out; a bare 401 from GitHub's
    // private Codespace port (no message) does not.
    if (error?.response?.status === 401 && error?.response?.data?.message) {
      useAuthStore.getState().logout();
    }
    // School suspended or driver made inactive: this account can't be used, so sign out.
    const code = error?.response?.data?.code;
    if (error?.response?.status === 403 && (code === 'SCHOOL_SUSPENDED' || code === 'DRIVER_INACTIVE') && useAuthStore.getState().token) {
      useAuthStore.getState().logout();
    }

    const noResponse = error?.code === 'ERR_NETWORK' || !error?.response;
    // NetInfo (device-level radio/Wi-Fi state) vs. axios getting no response
    // at all are different failures — a device can have "very good internet"
    // and still fail to reach EXPO_PUBLIC_API_URL (wrong LAN IP, server not
    // running, phone on a different network than the server). Only blame
    // "no internet" when the device itself actually reports being offline.
    const deviceIsOffline = noResponse && !useConnectionStore.getState().isOnline;

    // A 401 without our server's JSON message comes from GitHub, not AwaBus:
    // the Codespace port the app talks to (5000) is still Private.
    const codespacePortPrivate =
      error?.response?.status === 401 && !error?.response?.data?.message && /\.app\.github\.dev/.test(error?.config?.baseURL || '');

    const message =
      error?.response?.data?.message ||
      (codespacePortPrivate
        ? "The server in the Codespace isn't open to phones yet: in the Codespace Ports tab, set port 5000 to Public, then try again."
        : null) ||
      (deviceIsOffline
        ? 'No internet connection. Check your data or Wi-Fi and try again.'
        : noResponse
          ? "Can't reach the AwaBus server. Check that the server is running and EXPO_PUBLIC_API_URL is set to your computer's address, not localhost."
          : error?.message) ||
      'Something went wrong. Please try again.';
    const wrapped = new Error(message);
    wrapped.isNetworkError = noResponse;
    wrapped.status = error?.response?.status || 0; // lets the offline queue tell "try later" from "never"

    return Promise.reject(wrapped);
  }
);

export default apiClient;
