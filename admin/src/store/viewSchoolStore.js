import { create } from 'zustand';
import { queryClient } from '../lib/queryClient.js';

// Which school a superadmin is looking at on the school pages (Students,
// Live Tracking, ...). Sent to the server as the X-View-School header.
// Kept per tab (sessionStorage), like the sign-in, so another tab signing in
// or out never changes it; localStorage only seeds newly opened tabs.
const STORAGE_KEY = 'awabus_view_school';

const read = (storage) => {
  try {
    return JSON.parse(storage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
};
const write = (storage, value) => {
  try {
    if (value) storage.setItem(STORAGE_KEY, JSON.stringify(value));
    else storage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: the choice just won't survive a reload */
  }
};

const load = () => {
  const mine = read(sessionStorage);
  if (mine) return mine;
  const shared = read(localStorage);
  if (shared) write(sessionStorage, shared);
  return shared;
};

export const useViewSchoolStore = create((set) => ({
  school: load(), // { id, name } or null

  setSchool: (school) => {
    const next = school ? { id: String(school.id || school._id), name: school.name } : null;
    write(sessionStorage, next);
    write(localStorage, next);
    // Drop everything loaded for the previous school before showing the next.
    queryClient.clear();
    set({ school: next });
  },

  // Called on this tab's sign-in / sign-out: only this tab forgets the school.
  clear: () => {
    write(sessionStorage, null);
    set({ school: null });
  },
}));
