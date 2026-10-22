/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Ported from apps/web/src/app/globals.css design tokens.
        ink: {
          900: "#1b1b1b",
          800: "#2a2a2a",
          700: "#3d3d3d",
          500: "#5e5e5e",
          400: "#9aa8b8",
          300: "#b8c4d0",
        },
        sand: {
          50: "#faf9f7",
          100: "#f4f1ed",
          200: "#e8e3db",
          300: "#d4cfc7",
        },
        teal: {
          100: "#e0f5f4",
          200: "#b0e5e3",
          500: "#0f8f8d",
          600: "#0c7b79",
          700: "#0a6d6b",
          800: "#074e4d",
        },
        coral: {
          100: "#fdeee9",
          400: "#f08a68",
          500: "#e06e48",
          700: "#b14a2a",
        },
        body: "#f8f8f7",
        surface: "#ffffff",
      },
      fontFamily: {
        display: ["Fraunces_600SemiBold"],
        "display-bold": ["Fraunces_700Bold"],
        sans: ["Manrope_400Regular"],
        medium: ["Manrope_500Medium"],
        semibold: ["Manrope_600SemiBold"],
        bold: ["Manrope_700Bold"],
        bengali: ["HindSiliguri_400Regular"],
        "bengali-semibold": ["HindSiliguri_600SemiBold"],
      },
    },
  },
  plugins: [],
};
