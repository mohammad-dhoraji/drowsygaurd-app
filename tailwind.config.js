/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#064e3b', // Deep green
          light: '#047857',
          dark: '#022c22',
        },
        secondary: {
          DEFAULT: '#6ee7b7', // Muted green
          light: '#a7f3d0',
          dark: '#34d399',
        },
        accent: {
          DEFAULT: '#0d9488', // Teal
        },
        darkBg: '#111827',
        lightBg: '#f9fafb',
        safe: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
}
