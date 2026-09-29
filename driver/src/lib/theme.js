// Shared design tokens — mirrors the color system used in /admin (navy from the
// sign-in page, mint/teal from the AwaBus logo) so both apps look the same.
export const colors = {
  navy: '#0b1b2b',
  navyLight: '#132a40',
  navyDark: '#081420',
  // Background colour of the AwaBus logo artwork (admin/public/awabus.svg);
  // used behind the logo on the splash screen.
  logoBg: '#0a1f2a',
  // Left pane / banner behind the logo on the sign-in pages (admin + driver).
  authBg: '#081922',

  brand50: '#ecfdf7',
  brand100: '#d1faec',
  brand300: '#7ee9c9',
  brand500: '#1cb894',
  brand600: '#0d9488',
  brand700: '#0c7a6f',

  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',

  emerald50: '#ecfdf5',
  emerald600: '#059669',
  emerald700: '#047857',

  red50: '#fef2f2',
  red500: '#ef4444',
  red600: '#dc2626',
  red700: '#b91c1c',

  amber50: '#fffbeb',
  amber500: '#f59e0b',
  amber700: '#b45309',
  amber800: '#92400e',

  white: '#ffffff',
};

export const spacing = (n) => n * 4;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export default colors;
