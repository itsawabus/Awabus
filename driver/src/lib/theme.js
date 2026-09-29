// Shared design tokens — mirrors the color system used in /admin (navy from the
// sign-in page, mint/teal from the AwaBus logo) so both apps look the same.
import { Appearance, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Light palette. Each name keeps one job: "white" is a card / sheet surface,
// slate50 the page, slate200 borders, slate400-900 text from faint to strong.
// Text and icons on coloured buttons and headers use onDark (always white);
// navy text uses ink.
const light = {
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
  trip600: '#0d9488',

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

  // Jobs that differ between light and dark:
  onDark: '#ffffff', // text / icons on navy, teal or red backgrounds
  ink: '#0b1b2b', // navy text and icons on cards
  primary: '#0b1b2b', // main buttons, progress, "Next" card
  dangerBg: '#dc2626', // red buttons (stays strong red in dark)
  page: '#f8fafc', // screen background
  warnBorder: '#fcd34d', // outline of yellow notices
  redBorder: '#fecaca', // outline of red notices / cards
  greenBorder: '#a7f3d0', // outline of green cards
};

// Dark palette: the same names, tuned for a dark screen (surfaces dark
// blue-grey, text light, tinted notice backgrounds deep, accent text brighter).
const dark = {
  ...light,
  brand50: '#0e2f2a',
  brand100: '#114038',
  brand700: '#2dd4bf',

  slate50: '#0c151d',
  slate100: '#1b2a37',
  slate200: '#26394a',
  slate300: '#3b5163',
  slate400: '#8196a8',
  slate500: '#9fb0bf',
  slate600: '#b8c6d2',
  slate700: '#cfd9e2',
  slate800: '#e3eaf0',
  slate900: '#f3f6f9',

  emerald50: '#0b2a20',
  emerald600: '#10b981',
  emerald700: '#34d399',

  red50: '#35161a',
  red600: '#f87171',
  red700: '#fca5a5',

  amber50: '#33260b',
  amber700: '#fbbf24',
  amber800: '#fcd34d',

  white: '#15222e',

  ink: '#e3eaf0',
  primary: '#0d9488',
  page: '#0c151d',
  warnBorder: '#7c5e10',
  redBorder: '#7f1d1d',
  greenBorder: '#065f46',
};

// The theme is read when the app starts and can be changed at any time
// (header sun / moon button, Settings > Appearance): the colours below are
// swapped in place and the screens are drawn again, without restarting.
export const THEME_KEY = 'awabus_theme';
function startTheme() {
  let saved = null;
  try {
    saved = SecureStore.getItem(THEME_KEY);
  } catch {
    saved = null;
  }
  const choice = saved === 'light' || saved === 'dark' ? saved : 'system';
  return choice === 'system' ? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light') : choice;
}

const PALETTES = { light, dark };
let scheme = startTheme();
let version = 0;

// One object for the whole app; its values change with the theme.
export const colors = { ...PALETTES[scheme] };

export const currentScheme = () => scheme;
export const themeVersion = () => version;

/** Switches every colour to the light or dark palette. Returns true if it changed. */
export function applyScheme(next) {
  if (!PALETTES[next] || next === scheme) return false;
  scheme = next;
  Object.assign(colors, PALETTES[next]);
  version += 1;
  return true;
}

// Styles and colour tables are made from `colors` when first used and made
// again after the theme changes, so they always use the current colours.
function lazyObject(make) {
  let made = null;
  let madeFor = -1;
  const get = () => {
    if (madeFor !== version) {
      made = make();
      madeFor = version;
    }
    return made;
  };
  return new Proxy(
    {},
    {
      get: (_, key) => get()[key],
      has: (_, key) => key in get(),
      ownKeys: () => Reflect.ownKeys(get()),
      getOwnPropertyDescriptor: (_, key) => {
        const d = Object.getOwnPropertyDescriptor(get(), key);
        return d ? { ...d, configurable: true } : undefined;
      },
    }
  );
}

/** Like StyleSheet.create, for styles that use theme colours: themed(() => ({ ... })). */
export const themed = (make) => lazyObject(() => StyleSheet.create(make()));

/** A plain lookup table that uses theme colours: themedMap(() => ({ ... })). */
export const themedMap = (make) => lazyObject(make);

export const spacing = (n) => n * 4;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export default colors;
