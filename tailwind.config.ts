import type { Config } from "tailwindcss";

// Tokens mirror lib/tokens.ts — keep these two files in sync.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ss: {
          bg0: "#ffffff",
          bg1: "rgba(255,255,255,0.94)",
          bg2: "rgba(244,196,48,0.12)",
          bg3: "rgba(244,196,48,0.20)",
          fg0: "#050505",
          fg1: "#2a2a2a",
          fg2: "#5c5642",
          fg3: "#8b846b",
          alert: "#f4c430",
          "alert-dim": "rgba(244,196,48,.18)",
          warn: "#d79b00",
          "warn-dim": "rgba(215,155,0,.16)",
          danger: "#050505",
          clear: "#050505",
          "clear-dim": "rgba(5,5,5,.10)",
          sky: "#050505",
          "sky-dim": "rgba(5,5,5,.10)",
          hairline: "rgba(5,5,5,0.12)",
          hairline2: "rgba(5,5,5,0.22)",
        },
      },
      fontFamily: {
        sans: ["var(--font-ui)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};

export default config;
