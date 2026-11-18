/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-inter)', 'Inter', 'monospace'],
      },
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#4f46e5',
          600: '#4338ca',
          700: '#3730a3',
          800: '#312e81',
          900: '#1e1b4b',
          950: '#0f172a',
        },
        sidebar: {
          bg: 'rgba(255, 255, 255, 0.03)',
          surface: 'rgba(255, 255, 255, 0.04)',
          border: 'rgba(255, 255, 255, 0.06)',
          muted: 'rgba(255, 255, 255, 0.50)',
          hover: 'rgba(255, 255, 255, 0.06)',
          active: 'rgba(99, 102, 241, 0.18)',
        },
      },
      boxShadow: {
        card: '0 10px 40px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.10)',
        panel: '0 10px 40px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.10)',
        soft: '0 8px 32px rgba(0, 0, 0, 0.20)',
        elevated: '0 20px 48px -4px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.10)',
        glow: '0 0 16px rgba(99, 102, 241, 0.25)',
      },
    },
  },
  plugins: [],
};
