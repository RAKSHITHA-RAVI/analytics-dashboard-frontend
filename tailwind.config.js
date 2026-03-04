/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2563eb", // blue-600
        accent: "#06b6d4",  // cyan-500
        card: "#ffffff",
        surface: "#f8fafc",
      },
      borderRadius: {
        xl2: "1rem",
      },
      boxShadow: {
        soft: "0 6px 24px rgba(16,24,40,0.06)",
      },
    },
  },
  plugins: [],
};
