import { create } from 'zustand';
import { queryClient } from '../lib/queryClient.js';
import { useViewSchoolStore } from './viewSchoolStore.js';

const DRAFT_PREFIX = 'awabus.draft.';

const STORAGE_KEY = 'awabus_admin_auth';

// Without "Remember this device" the sign-in lapses after this long. With it,
// it lasts until the token expires (7 days).
const UNREMEMBERED_HOURS = 12;

// Where a sign-in is kept:
// - sessionStorage: this tab's own sign-in. It survives reloads of the tab, so
//   a tab never turns into another account when it reloads (e.g. a school
//   admin in one tab and the superadmin in another, in the same browser).
// - localStorage: the sign-in a newly opened tab starts with (the last one
//   signed in or used). Changing it never affects tabs already open.
const read = (storage) => {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const write = (storage, value) => {
  try {
    if (value) storage.setItem(STORAGE_KEY, JSON.stringify(value));
    else storage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: signed in for this page only */
  }
};
const sameAccount = (a, b) => Boolean(a?.admin && b?.admin && (a.admin._id || a.admin.id) === (b.admin._id || b.admin.id));
const lapsed = (saved) => Boolean(saved?.until && Date.now() > saved.until);

const loadPersisted = () => {
  // This tab's own sign-in first; a new tab starts from the shared one.
  let saved = read(sessionStorage);
  if (!saved) {
    saved = read(localStorage);
    if (saved) write(sessionStorage, saved);
  }
  if (lapsed(saved)) {
    write(sessionStorage, null);
    if (sameAccount(read(localStorage), saved)) write(localStorage, null);
    return null;
  }
  return saved;
};

const persisted = loadPersisted();

/** True when this tab's sign-in without "Remember this device" has run out. */
export const signInLapsed = () => lapsed(read(sessionStorage));

// Keeps the expiry of the current sign-in when the token or profile is updated.
// The shared copy is only updated if it is the same account.
const save = (value) => {
  const mine = read(sessionStorage);
  const next = mine?.until ? { ...value, until: mine.until } : value;
  write(sessionStorage, next);
  if (!read(localStorage) || sameAccount(read(localStorage), next)) write(localStorage, next);
};

// A tab being used makes its account the one new tabs open with.
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    const mine = read(sessionStorage);
    if (mine?.token && !lapsed(mine)) write(localStorage, mine);
  });
}

export const useAuthStore = create((set) => ({
  token: persisted?.token || null,
  admin: persisted?.admin || null,
  isAuthenticated: Boolean(persisted?.token),

  setAuth: ({ token, admin }, { remember = true } = {}) => {
    // A new sign-in starts clean: nothing loaded for a previous account is kept.
    queryClient.clear();
    useViewSchoolStore.getState().clear();
    const until = remember ? undefined : Date.now() + UNREMEMBERED_HOURS * 60 * 60 * 1000;
    const value = { token, admin, until };
    write(sessionStorage, value);
    write(localStorage, value);
    set({ token, admin, isAuthenticated: true });
  },

  // A new sign-in token for the same account (e.g. after changing the password,
  // which signs out every other session).
  setToken: (token) => {
    set((state) => {
      save({ token, admin: state.admin });
      return { token };
    });
  },

  updateAdmin: (admin) => {
    set((state) => {
      save({ token: state.token, admin });
      return { admin };
    });
  },

  logout: () => {
    const mine = read(sessionStorage);
    write(sessionStorage, null);
    // Only forget the shared sign-in if it is this account; another account
    // signed in in another tab stays signed in.
    if (!mine || sameAccount(read(localStorage), mine)) {
      write(localStorage, null);
      try {
        localStorage.removeItem('awabus_view_school'); // the school new tabs would open on
      } catch {
        /* ignore */
      }
    }
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
