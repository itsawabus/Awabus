// Shown small on the sign-in screen and in Settings, so it is easy to tell
// which code a phone is running and which server it talks to. Change
// CODE_LABEL with each driver-app change; if a phone still shows an older
// label, it is running an older bundle (an installed APK, or Expo not
// restarted with --clear).
export const CODE_LABEL = '2026-09-30 · Render server';

// The server this build sends to (EXPO_PUBLIC_API_URL is baked in when Expo
// bundles the app).
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://awabus.onrender.com/api';

export const serverName = () => {
  const host = API_URL.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (host.endsWith('.app.github.dev')) return 'Codespace';
  if (host.includes('onrender.com')) return 'Render (main)';
  return host;
};

export const buildLine = () => `Code ${CODE_LABEL} · Server: ${serverName()}`;
