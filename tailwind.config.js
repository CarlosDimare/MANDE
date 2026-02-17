/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    fontFamily: {
      sans: ['Rodchenko', 'system-ui', 'sans-serif'],
      head: ['Rodchenko', 'Impact', 'sans-serif'],
    },
    extend: {
      colors: {
        'construct-red': '#D92B2B',
        'construct-cream': '#F2EFE9',
        'construct-black': '#050505',
      }
    }
  },
  plugins: [],
}
