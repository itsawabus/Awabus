import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'awabus_driver_token';
const DRIVER_KEY = 'awabus_driver_profile';

// AsyncStorage/SecureStore are async, unlike localStorage on web, so this
// store starts unhydrated and the root layout awaits `hydrate()` once before
// rendering the authenticated/unauthenticated route tree.
export const useAuthStore = create((set) => ({
  token: null,
  driver: null,
  isAuthenticated: false,
  isHydrated: false,

  hydrate: async () => {
    try {
      const [token, driverJson] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        AsyncStorage.getItem(DRIVER_KEY),
      ]);
      set({
        token: token || null,
        driver: driverJson ? JSON.parse(driverJson) : null,
        isAuthenticated: Boolean(token),
        isHydrated: true,
      });
    } catch {
      set({ isHydrated: true });
    }
  },

  setAuth: async ({ token, driver }) => {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      AsyncStorage.setItem(DRIVER_KEY, JSON.stringify(driver)),
    ]);
    set({ token, driver, isAuthenticated: true });
  },

  updateDriver: async (driver) => {
    await AsyncStorage.setItem(DRIVER_KEY, JSON.stringify(driver));
    set({ driver });
  },

  logout: async () => {
    await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), AsyncStorage.removeItem(DRIVER_KEY)]);
    set({ token: null, driver: null, isAuthenticated: false });
  },
}));
