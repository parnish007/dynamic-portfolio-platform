// C:\Users\AB\Desktop\portfolio-website\tailwind.config.js

/** @type {import('tailwindcss').Config} */
module.exports = {
  /*
    Tailwind is OPTIONAL in this project.
    This config is aligned with your CSS-first system:
    - CSS variables are the source of truth
    - Tailwind is used only as a utility accelerator
  */

  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
  ],

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

        text: "var(--color-text)",
        muted: "var(--color-muted)",

        border: "var(--color-border)",

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

  plugins: [
    /*
      Keep plugins MINIMAL.
      Add only if explicitly needed.
      Examples (optional):
        require("@tailwindcss/typography"),
        require("@tailwindcss/forms"),
    */
  ],

  darkMode: ["class", '[data-theme="dark"]'],
};
