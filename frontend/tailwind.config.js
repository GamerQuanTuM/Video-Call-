/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: "#0d9488",
          light: "#5eead4",
          dark: "#115e59",
        },
      },
    },
  },
  plugins: [],
};
