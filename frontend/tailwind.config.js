/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        se: {
          green: '#009E4D',
          'green-dark': '#007A3D',
          'green-light': '#00C460',
          'green-50': '#E6F7EF',
          'green-100': '#B3E8D1',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
