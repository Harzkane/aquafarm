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
        pond: {
          50:  "#f7f7f8",
          100: "#eeeff1",
          200: "#d7dae0",
          300: "#b9bec8",
          400: "#929aa8",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#111827",
          950: "#0a0a0b",
        },
        water: {
          50:  "#eff9ff",
          100: "#def2ff",
          200: "#b6e8ff",
          300: "#75d7ff",
          400: "#2cc2ff",
          500: "#00a8f0",
          600: "#0086cc",
          700: "#006ba5",
          800: "#005a88",
          900: "#064b71",
        },
        mud: {
          50:  "#faf8f1",
          100: "#f2eddc",
          200: "#e4d9b5",
          300: "#d3bf86",
          400: "#c4a45e",
          500: "#b68d45",
          600: "#9e743a",
          700: "#825c32",
          800: "#6b4b2e",
          900: "#593f29",
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body:    ["var(--font-body)", "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "pond-gradient": "linear-gradient(135deg, #0a0a0b 0%, #111827 40%, #374151 100%)",
        "water-shimmer": "linear-gradient(180deg, #064b71 0%, #006ba5 50%, #0086cc 100%)",
        "card-shine": "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 60%)",
      },
      boxShadow: {
        "pond": "0 4px 24px rgba(10, 10, 11, 0.45)",
        "card": "0 2px 16px rgba(10, 10, 11, 0.24), 0 1px 4px rgba(10, 10, 11, 0.18)",
        "glow-green": "0 0 30px rgba(148, 163, 184, 0.25)",
        "glow-water": "0 0 30px rgba(0, 168, 240, 0.25)",
      },
      animation: {
        "shimmer": "shimmer 2.5s linear infinite",
        "float":   "float 6s ease-in-out infinite",
        "pulse-slow": "pulse 4s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
