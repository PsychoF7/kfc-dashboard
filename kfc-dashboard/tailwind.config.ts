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
          50: "#F3E9FF",
          100: "#E6D1FF",
          500: "#891DFF",
          600: "#7015D6",
          700: "#5A11AD",
          900: "#370A66",
        },
        peri: {
          DEFAULT: "#7D8FFF",
          50: "#EEF0FF",
        },
        ink: {
          50: "#E9EAF2",
          100: "#DEDDEB",
          200: "#CFCEDD",
          300: "#ABAAC2",
          500: "#6E6E86",
          700: "#3D3D52",
          800: "#2B2B3D",
          900: "#212135",
        },
        success: { DEFAULT: "#1F8A54", bg: "#E3F5EA" },
        warning: { DEFAULT: "#C8790A", bg: "#FBF0DD" },
        danger: { DEFAULT: "#D14545", bg: "#FBE6E6" },
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
