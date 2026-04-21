import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Theme-aware via CSS vars — swap in globals.css on html.dark
        parchment: "rgb(var(--c-parchment) / <alpha-value>)",
        earth: "rgb(var(--c-earth) / <alpha-value>)",
        "earth-light": "rgb(var(--c-earth-light) / <alpha-value>)",
        // Brand accents stay the same in both modes
        amber: "#D4A843",
        sage: "#7A8C6E",
        terracotta: "#C17F5A",
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
