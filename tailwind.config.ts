import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "media",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        "ink-faint": "var(--ink-faint)",
        border: "var(--border)",
        "border-soft": "var(--border-soft)",
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        "primary-wash": "var(--primary-wash)",
        danger: "var(--danger)",
        "danger-wash": "var(--danger-wash)",
        success: "var(--success)",
        "success-wash": "var(--success-wash)",
        neutral: "var(--neutral)",
        "neutral-wash": "var(--neutral-wash)",
        "chalk-bg": "var(--chalk-bg)",
        "chalk-surface": "var(--chalk-surface)",
        "chalk-ink": "var(--chalk-ink)",
        "chalk-ink-soft": "var(--chalk-ink-soft)",
        "chalk-border": "var(--chalk-border)",
        "chalk-accent": "var(--chalk-accent)",
        "chalk-accent-wash": "var(--chalk-accent-wash)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
