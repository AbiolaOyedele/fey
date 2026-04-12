/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'Noto Sans', 'sans-serif'],
        display: ['Fraunces', 'Noto Sans', 'serif'],
        mono: ['inherit'],
      },
      colors: {
        primary: '#667EEA',
        success: '#48BB78',
        pending: '#F6AD55',
        danger: '#FC8181',
        appbg: '#F7F8FA',
      },
    },
  },
  plugins: [],
}
