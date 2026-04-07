import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)"],
        ui: ["var(--font-ui)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        bg: {
          DEFAULT: "var(--color-bg)",
          surface: "var(--color-bg-surface)",
          subtle: "var(--color-bg-subtle)",
          muted: "var(--color-bg-muted)",
        },
        card: {
          lavender: "var(--color-card-lavender)",
          peach: "var(--color-card-peach)",
          sky: "var(--color-card-sky)",
          mint: "var(--color-card-mint)",
          lemon: "var(--color-card-lemon)",
          rose: "var(--color-card-rose)",
        },
        text: {
          primary: "var(--color-text-primary)",
          body: "var(--color-text-body)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
          inverse: "var(--color-text-inverse)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          light: "var(--color-accent-light)",
          subtle: "var(--color-accent-subtle)",
        },
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          light: "var(--color-primary-light)",
          glow: "var(--color-primary-glow)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          light: "var(--color-success-light)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          light: "var(--color-warning-light)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          light: "var(--color-danger-light)",
        },
        info: {
          DEFAULT: "var(--color-info)",
          light: "var(--color-info-light)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          strong: "var(--color-border-strong)",
          focus: "var(--color-border-focus)",
        },
        p1: "var(--color-p1)",
        p2: "var(--color-p2)",
        p3: "var(--color-p3)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        card: "var(--shadow-card)",
        nav: "var(--shadow-nav)",
        cta: "var(--shadow-cta)",
      },
      fontSize: {
        xs: "var(--text-xs)",
        sm: "var(--text-sm)",
        base: "var(--text-base)",
        md: "var(--text-md)",
        lg: "var(--text-lg)",
        xl: "var(--text-xl)",
        "2xl": "var(--text-2xl)",
        "3xl": "var(--text-3xl)",
      },
    },
  },
  plugins: [],
};
export default config;
