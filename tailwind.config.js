// tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  /*
    Tailwind is OPTIONAL in this project.

    Strategy (P0 CSS Fix):
    - CSS variables + CSS files are the source of truth
    - Tailwind is an *opt-in* utility accelerator
    - To avoid unreadable UI from conflicts:
      1) Disable Tailwind preflight (we use our own globals.css)
      2) Prefix all Tailwind classes with "tw-"
         Example: tw-bg-bg tw-text-text tw-flex tw-gap-3
  */

  prefix: "tw-",

  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
  ],

  darkMode: ["class", '[data-theme="dark"]'],

  corePlugins: {
    preflight: false,
  },

  theme: {
    container: {
      center: true,
      padding: "1.25rem",
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1200px",
        "2xl": "1440px",
      },
    },

    extend: {
      /* ------------------------------------------------------------------ */
      /* Colors (mapped to CSS variables)                                    */
      /* ------------------------------------------------------------------ */

      colors: {
        primary: "var(--color-primary)",
        "primary-hover": "var(--color-primary-hover)",

        secondary: "var(--color-secondary)",
        "secondary-hover": "var(--color-secondary-hover)",

        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        "surface-3": "var(--color-surface-3)",

        text: "var(--color-text)",
        muted: "var(--color-muted)",
        "muted-soft": "var(--color-muted-soft)",

        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",

        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
      },

      /* ------------------------------------------------------------------ */
      /* Typography                                                          */
      /* ------------------------------------------------------------------ */

      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },

      fontSize: {
        xs: "var(--text-xs)",
        sm: "var(--text-sm)",
        base: "var(--text-base)",
        lg: "var(--text-lg)",
        xl: "var(--text-xl)",
        "2xl": "var(--text-2xl)",
        "3xl": "var(--text-3xl)",
      },

      /* ------------------------------------------------------------------ */
      /* Radius & Shadows                                                    */
      /* ------------------------------------------------------------------ */

      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },

      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },

      /* ------------------------------------------------------------------ */
      /* Motion                                                              */
      /* ------------------------------------------------------------------ */

      transitionTimingFunction: {
        standard: "var(--ease-standard)",
        "ease-in": "var(--ease-in)",
        "ease-out": "var(--ease-out)",
      },

      transitionDuration: {
        fast: "var(--duration-fast)",
        normal: "var(--duration-normal)",
        slow: "var(--duration-slow)",
      },
    },
  },

  plugins: [],
};
