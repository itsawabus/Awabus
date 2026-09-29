import { create } from 'zustand';
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { THEME_KEY, applyScheme, themeVersion } from '../lib/theme.js';
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

// Saved for the next start too (src/lib/theme.js reads it before the first screen).
const saveThemeForStart = (theme) => {
  try {
    SecureStore.setItem(THEME_KEY, theme);
  } catch {
    // web: no secure store
  }
};

const themeNow = (theme) => (theme === 'system' ? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light') : theme);

export const useUiStore = create((set, get) => ({
  ...defaultPrefs,
  isHydrated: false,
  // Goes up each time the colours change; the app draws its screens again.
  themeVersion: themeVersion(),

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(PREFS_KEY);
      const prefs = raw ? { ...defaultPrefs, ...JSON.parse(raw) } : defaultPrefs;
      applyTheme(prefs.theme);
      // Older versions kept the theme only here: copy it for the next start.
      saveThemeForStart(prefs.theme);
      applyScheme(themeNow(prefs.theme));
      set({ ...prefs, isHydrated: true, themeVersion: themeVersion() });
      // "Phone setting": follow the phone when it switches light / dark.
      Appearance.addChangeListener(() => {
        if (get().theme === 'system' && applyScheme(themeNow('system'))) set({ themeVersion: themeVersion() });
      });
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
      // New colours straight away, no restart.
      if (applyScheme(themeNow(value))) set({ themeVersion: themeVersion() });
    }
  },
}));
