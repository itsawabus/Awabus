import { create } from 'zustand';

const THEME_KEY = 'awabus_admin_theme';

const applyTheme = (isDark) => {
  const root = document.documentElement;
  if (isDark) root.classList.add('dark');
  else root.classList.remove('dark');
};

const initialDark = localStorage.getItem(THEME_KEY) === 'dark';
applyTheme(initialDark);

export const useUiStore = create((set, get) => ({
  darkMode: initialDark,
  toggleDarkMode: () => {
    const next = !get().darkMode;
    localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    applyTheme(next);
    set({ darkMode: next });
  },

  // Sidebar is a mobile drawer: closed by default, opened via hamburger,
  // and always visible (via lg:translate-x-0) on large screens.
  sidebarOpen: false,
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));