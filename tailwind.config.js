/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['NoirPro', 'sans-serif'],
        display: ['NoirPro', 'sans-serif'],
        mono: ['inherit'],
      },
      colors: {
        primary: '#ED64A6',
        success: '#48BB78',
        pending: '#F6AD55',
        danger: '#FC8181',
        appbg: '#F7F8FA',
      },
    },
  },
  plugins: [],
}
