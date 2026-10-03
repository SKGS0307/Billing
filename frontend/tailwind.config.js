/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#11110f',
        gold: { 50: '#fbf8ee', 100: '#f5edcf', 400: '#c9a84c', 500: '#aa8730', 600: '#8c6c25' },
      },
      boxShadow: { soft: '0 18px 45px rgba(17, 17, 15, 0.08)' },
    },
  },
  plugins: [],
};
