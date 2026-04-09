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
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          500: '#4f46e5',
          700: '#4338ca',
        },
      },
      boxShadow: {
        panel: '0 8px 24px rgba(15, 23, 42, 0.08)',
        soft: '0 6px 18px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
};
