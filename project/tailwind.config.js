/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        green: {
          50: '#fff7ed',   // Very light orange
          100: '#ffedd5',  // Light orange  
          200: '#fed7aa',  // Medium light orange
          500: '#ed8b00',  // Your exact orange color for focus rings
          600: '#ed8b00',  // Your exact orange color (main usage)
          700: '#c2410c',  // Darker orange for hover states
        },
        blue: {
          50: '#f0f8ff',   // Very light blue
          100: '#e0f2ff',  // Light blue
          200: '#b3d9ff',  // Medium light blue
          500: '#0085ca',  // Your exact blue color for focus/border
          600: '#0085ca',  // Your exact blue color (main usage)
          700: '#006ba3',  // Darker blue for hover states
          800: '#005582',  // Dark blue for text
          900: '#004466',  // Very dark blue for text
        },
        slate: {
          50: '#f8f8f7',   // Very light warm gray
          200: '#e2e2e0',  // Light border gray
          300: '#c6c6c3',  // Medium border gray
          400: '#9a9a96',  // Light text gray
          500: '#7a7a75',  // Medium text gray
          600: '#5c5c57',  // Darker text gray
          700: '#424240',  // Dark text gray
          800: '#363634',  // Very dark text gray
          900: '#30302f',  // Your exact dark color (main dark text/bg)
        }
      }
    },
  },
  plugins: [],
};
