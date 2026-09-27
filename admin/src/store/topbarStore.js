import { create } from 'zustand';

// Lets any page declare its breadcrumb + live search box without prop-drilling
// through the shared AdminLayout/Topbar.
export const useTopbarStore = create((set) => ({
  breadcrumb: ['AwaBus', 'Dashboard'],
  searchValue: '',
  searchPlaceholder: 'Search routes, buses, students...',
  onSearchChange: null,
  setTopbar: (partial) => set(partial),
  resetSearch: () =>
    set({ searchValue: '', searchPlaceholder: 'Search routes, buses, students...', onSearchChange: null }),
}));
