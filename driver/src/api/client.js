import axios from 'axios';
import { API_URL } from '../lib/buildInfo.js';
import { useAuthStore } from '../store/authStore.js';
import { useConnectionStore } from '../store/connectionStore.js';
import { useLocationStatusStore } from '../store/locationStatusStore.js';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Tells the school whether this phone is reading the bus location (bus online / offline).
  const location = useLocationStatusStore.getState().state;
  if (location === 'on') config.headers['X-Location'] = 'on';
  else if (location === 'off' || location === 'denied') config.headers['X-Location'] = 'off';
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

    // An answer that is not from AwaBus (no message): a stopped Codespace
    // (GitHub's 404 page) or a server still starting up (Render: 502/503).
    const base = error?.config?.baseURL || '';
    const onCodespace = /\.app\.github\.dev/.test(base);
    const notAwaBus = Boolean(error?.response) && !error?.response?.data?.message && [404, 502, 503, 504].includes(error.response.status);
    const serverDown = notAwaBus
      ? onCodespace
        ? 'This app is set to use a Codespace server, and that Codespace is stopped. Start it (with port 5000 public), or install an app built for the Render server.'
        : /onrender\.com/.test(base)
          ? 'The AwaBus server is waking up. Wait about a minute and try again.'
          : "The AwaBus server isn't answering right now. Try again in a minute."
      : null;

    const message =
      error?.response?.data?.message ||
      serverDown ||
      (codespacePortPrivate
        ? "The server in the Codespace isn't open to phones yet: in the Codespace Ports tab, set port 5000 to Public, then try again."
        : null) ||
      (deviceIsOffline
        ? 'No internet connection. Check your data or Wi-Fi and try again.'
        : noResponse
          ? onCodespace
            ? "Can't reach the AwaBus server. This app is set to use a Codespace server: it only works while that Codespace is running."
            : "Can't reach the AwaBus server. Check your internet and try again."
          : error?.message) ||
      'Something went wrong. Please try again.';
    const wrapped = new Error(message);
    wrapped.isNetworkError = noResponse;
    wrapped.status = error?.response?.status || 0; // lets the offline queue tell "try later" from "never"

    return Promise.reject(wrapped);
  }
);

export default apiClient;
