import { create } from 'zustand';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = 'awabus_driver_prefs';

const defaultPrefs = {
  theme: 'system', // 'system' | 'light' | 'dark'
  notificationSounds: true,
  vibration: true,
  autoSyncOnMobileData: false,
  offlineCacheLimitTrips: 50,
};

// RN's Appearance.setColorScheme only accepts 'light' | 'dark' | 'unspecified'
// ('unspecified' resets the app back to following the OS setting).
const applyTheme = (theme) => {
  Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
};

export const useUiStore = create((set, get) => ({
  ...defaultPrefs,
  isHydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(PREFS_KEY);
      const prefs = raw ? { ...defaultPrefs, ...JSON.parse(raw) } : defaultPrefs;
      applyTheme(prefs.theme);
      set({ ...prefs, isHydrated: true });
    } catch {
      set({ isHydrated: true });
    }
  },

  setPref: async (key, value) => {
    const next = { ...get(), [key]: value };
    const persisted = Object.keys(defaultPrefs).reduce((acc, k) => ({ ...acc, [k]: next[k] }), {});
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(persisted));
    if (key === 'theme') applyTheme(value);
    set({ [key]: value });
  },
}));
