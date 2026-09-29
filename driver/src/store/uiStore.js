import { create } from 'zustand';
import { Appearance, DevSettings, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import { THEME_KEY, scheme } from '../lib/theme.js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = 'awabus_driver_prefs';

const defaultPrefs = {
  theme: 'system', // 'system' | 'light' | 'dark'
  notificationSounds: true,
  vibration: true,
  autoSyncOnMobileData: false,
  offlineCacheLimitTrips: 50,
  // Newest notification time the driver has seen (for the bell's red dot).
  notificationsSeenAt: 0,
};

// RN's Appearance.setColorScheme only accepts 'light' | 'dark' | 'unspecified'
// ('unspecified' resets the app back to following the OS setting).
const applyTheme = (theme) => {
  try {
    Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
  } catch {
    // not supported here (web)
  }
};

// The screens' colours are fixed when the app starts (src/lib/theme.js reads
// this synchronously), so a new theme is saved there and the app restarts.
const saveThemeForStart = (theme) => {
  try {
    SecureStore.setItem(THEME_KEY, theme);
  } catch {
    // web: no secure store
  }
};

const themeNow = (theme) => (theme === 'system' ? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light') : theme);

async function restartApp() {
  if (Platform.OS === 'web') {
    window.location.reload();
    return;
  }
  try {
    await Updates.reloadAsync();
  } catch {
    DevSettings.reload();
  }
}

export const useUiStore = create((set, get) => ({
  ...defaultPrefs,
  isHydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(PREFS_KEY);
      const prefs = raw ? { ...defaultPrefs, ...JSON.parse(raw) } : defaultPrefs;
      applyTheme(prefs.theme);
      // Older versions kept the theme only here: copy it for the next start.
      saveThemeForStart(prefs.theme);
      set({ ...prefs, isHydrated: true });
    } catch {
      set({ isHydrated: true });
    }
  },

  setPref: async (key, value) => {
    const next = { ...get(), [key]: value };
    const persisted = Object.keys(defaultPrefs).reduce((acc, k) => ({ ...acc, [k]: next[k] }), {});
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(persisted));
    set({ [key]: value });
    if (key === 'theme') {
      applyTheme(value);
      saveThemeForStart(value);
      // Restart only when the colours actually change.
      if (themeNow(value) !== scheme) setTimeout(restartApp, 350);
    }
  },
}));
