import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: "#F5F0E8",
        earth: "#2C1810",
        amber: "#D4A843",
        sage: "#7A8C6E",
        terracotta: "#C17F5A",
        "earth-light": "#4A2E20",
        "amber-light": "#E8C47A",
        "sage-light": "#9BAD8E",
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        mono: ["IBM Plex Mono", "Courier New", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        grain: "url('/grain.png')",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "page-in": "pageIn 0.4s ease-out",
        "slide-in-left": "slideInLeft 0.35s ease-out",
        "slide-in-right": "slideInRight 0.35s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pageIn: {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInLeft: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
