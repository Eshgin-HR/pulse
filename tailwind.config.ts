import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        app: "var(--bg-app)",
        surface: "var(--bg-surface)",
        subtle: "var(--bg-subtle)",
        elevated: "var(--bg-elevated)",
        brand: {
          DEFAULT: "var(--brand)",
          hover: "var(--brand-hover)",
          subtle: "var(--brand-subtle)",
        },
        tx: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          inverse: "var(--text-inverse)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
          focus: "var(--border-focus)",
        },
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        glow: "var(--shadow-glow)",
      },
      fontSize: {
        "2xs": "11px",
        xs: "12px",
        sm: "13px",
        base: "14px",
        md: "15px",
        lg: "18px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "32px",
      },
    },
  },
  plugins: [],
};
export default config;
