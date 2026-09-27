import { create } from 'zustand';
import { queryClient } from '../lib/queryClient.js';

// Which school a superadmin is looking at on the school pages (Students,
// Live Tracking, ...). Sent to the server as the X-View-School header.
const STORAGE_KEY = 'awabus_view_school';

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
};

export const useViewSchoolStore = create((set) => ({
  school: load(), // { id, name } or null

  setSchool: (school) => {
    const next = school ? { id: String(school.id || school._id), name: school.name } : null;
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable: the choice just won't survive a reload */
    }
    // Drop everything loaded for the previous school before showing the next.
    queryClient.clear();
    set({ school: next });
  },

  clear: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    set({ school: null });
  },
}));
