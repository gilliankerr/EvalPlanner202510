/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // LogicalOutcomes Brand Colors
        'lo-blue': '#0085ca',       // Pantone Process Blue C - Primary
        'lo-orange': '#ed8b00',     // Pantone 144 C - Primary  
        'lo-green': '#26d07c',      // Pantone 7479 C - Secondary
        'lo-yellow': '#f6eb61',     // Pantone 100 C - Secondary
        'lo-charcoal': '#30302f',   // Charcoal - Neutral text
        'lo-gray': '#e6e7e8',       // Gray - Neutral background
      }
    },
  },
  plugins: [],
};
