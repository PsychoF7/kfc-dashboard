import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf2f2",
          100: "#fce4e4",
          500: "#c8102e",
          600: "#a80d26",
          700: "#8a0a1f",
          900: "#4d0511",
        },
        ink: {
          50: "#f7f7fa",
          100: "#eeeef3",
          200: "#d9d9e3",
          300: "#b7b7c8",
          500: "#6b6b80",
          700: "#3a3a4a",
          800: "#252531",
          900: "#16161f",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
