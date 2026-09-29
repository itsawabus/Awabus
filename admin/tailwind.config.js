/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0b1b2b',
          light: '#132a40',
          dark: '#081420',
        },
        brand: {
          50: '#ecfdf7',
          100: '#d1faec',
          200: '#a7f3d8',
          300: '#7ee9c9',
          400: '#3ed6ac',
          500: '#1cb894',
          600: '#0d9488',
          700: '#0c7a6f',
          800: '#0f6259',
          900: '#0f504a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.06), 0 1px 3px 0 rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};
