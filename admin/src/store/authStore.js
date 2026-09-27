import { create } from 'zustand';
import { queryClient } from '../lib/queryClient.js';
import { useViewSchoolStore } from './viewSchoolStore.js';

const DRAFT_PREFIX = 'awabus.draft.';

const STORAGE_KEY = 'awabus_admin_auth';

const loadPersisted = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const persisted = loadPersisted();

export const useAuthStore = create((set) => ({
  token: persisted?.token || null,
  admin: persisted?.admin || null,
  isAuthenticated: Boolean(persisted?.token),

  setAuth: ({ token, admin }) => {
    // A new sign-in starts clean: nothing loaded for a previous account is kept.
    queryClient.clear();
    useViewSchoolStore.getState().clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin }));
    set({ token, admin, isAuthenticated: true });
  },

  updateAdmin: (admin) => {
    set((state) => {
      const next = { token: state.token, admin };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return { admin };
    });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    // Unsaved form drafts can contain student/driver personal data.
    Object.keys(localStorage)
      .filter((k) => k.startsWith(DRAFT_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    // Forget everything this account loaded (students, live trips, ...) so the
    // next person to sign in on this browser never sees it, even briefly.
    queryClient.clear();
    useViewSchoolStore.getState().clear();
    set({ token: null, admin: null, isAuthenticated: false });
  },
}));
