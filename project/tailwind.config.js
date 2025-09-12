/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0085ca',
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0085ca',
          600: '#0085ca',
          700: '#006ba6',
          800: '#075985',
          900: '#0c4a6e',
        },
        footer: '#ed8b00',
      },
    },
  },
  plugins: [],
};
