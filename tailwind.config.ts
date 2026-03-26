import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1e3a8a", // Navy Blue
          dark: "#1e40af",
          light: "#3b82f6",
        },
        secondary: {
          DEFAULT: "#d4af37", // Gold
          dark: "#b8941f",
          light: "#f4d03f",
        },
        background: {
          DEFAULT: "#ffffff",
          soft: "#f8f9fa",
          gray: "#f1f3f5",
        },
        text: {
          DEFAULT: "#1e293b",
          light: "#64748b",
          muted: "#94a3b8",
        },
      },
      fontFamily: {
        sans: ["var(--font-cairo)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
