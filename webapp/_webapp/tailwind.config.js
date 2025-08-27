// tailwind.config.js
const { heroui } = require("@heroui/react");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}", "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          "0%": {
            "background-position-x": "-100%",
            "background-size": "50% 100%",
            transform: "unset !important",
          },
          "100%": {
            "background-position-x": "250%",
            "background-size": "50% 100%",
            transform: "unset !important",
          },
        },
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: {
              DEFAULT: "#098842",
              100: "#e6f5ed",
              200: "#c3e6d3",
              300: "#9fd7b9",
              400: "#7cc89f",
              500: "#58b985",
              600: "#35aa6b",
              700: "#098842",
              800: "#076e35",
              900: "#054528",
            },
          },
        },
        dark: {
          colors: {
            primary: {
              DEFAULT: "#098842",
              100: "#e6f5ed",
              200: "#c3e6d3",
              300: "#9fd7b9",
              400: "#7cc89f",
              500: "#58b985",
              600: "#35aa6b",
              700: "#098842",
              800: "#076e35",
              900: "#054528",
            },
          },
        },
      },
    }),
  ],
};
