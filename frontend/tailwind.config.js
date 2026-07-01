/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Poppins", "ui-sans-serif", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#00BAF2",
          light: "#E6F8FE",
          navy: "#002E6E",
          dark: "#00224F",
        },
      },
    },
  },
  plugins: [],
}
