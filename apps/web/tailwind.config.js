/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        petrol: '#1a5c64',
        lilas: '#6d4e7c',
        bronze: '#a68448',
        pele: '#f6f1ea',
      },
      fontFamily: {
        marca: ['Josefin Sans', 'Century Gothic', 'Trebuchet MS', 'sans-serif'],
      },
      minHeight: {
        11: '2.75rem',
      },
    },
  },
  plugins: [],
};
