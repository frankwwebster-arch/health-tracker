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
        surface: "#f8f7f4",
        muted: "#6b7280",
        accent: "#4a7c59",
        border: "#e5e2dc",
      },
    },
  },
  plugins: [],
};
export default config;
