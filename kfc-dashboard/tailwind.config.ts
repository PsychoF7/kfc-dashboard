import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
        },
        peri: {
          DEFAULT: "rgb(var(--peri) / <alpha-value>)",
          50: "rgb(var(--peri-50) / <alpha-value>)",
        },
        ink: {
          50: "rgb(var(--ink-50) / <alpha-value>)",
          100: "rgb(var(--ink-100) / <alpha-value>)",
          200: "rgb(var(--ink-200) / <alpha-value>)",
          300: "rgb(var(--ink-300) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
        },
        success: { DEFAULT: "rgb(var(--success) / <alpha-value>)", bg: "rgb(var(--success-bg) / <alpha-value>)" },
        warning: { DEFAULT: "rgb(var(--warning) / <alpha-value>)", bg: "rgb(var(--warning-bg) / <alpha-value>)" },
        danger: { DEFAULT: "rgb(var(--danger) / <alpha-value>)", bg: "rgb(var(--danger-bg) / <alpha-value>)" },
      },
      // "bg-white" es la superficie de tarjetas, menús y campos: cambia en modo oscuro.
      // (text-white se queda blanco, para los botones morados.)
      backgroundColor: {
        white: "rgb(var(--surface) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-inter, system-ui)", "system-ui", "sans-serif"],
        display: ["var(--font-gantari, system-ui)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(33 33 53 / 0.03), 0 8px 24px -12px rgb(33 33 53 / 0.10)",
      },
    },
  },
  plugins: [],
};
export default config;
