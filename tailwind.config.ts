import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Arial Narrow", "Helvetica Neue", "sans-serif"],
        body: ["var(--font-body)", "Helvetica Neue", "Arial", "sans-serif"],
        // legacy names used by older components; all point at the new faces
        primary: ["var(--font-display)", "sans-serif"],
        secondary: ["var(--font-body)", "sans-serif"],
        tertiary: ["var(--font-body)", "sans-serif"],
        quaternary: ["var(--font-body)", "sans-serif"],
        quinary: ["var(--font-body)", "sans-serif"],
      },
      colors: {
        ink: { DEFAULT: "rgb(var(--af-ink-rgb) / <alpha-value>)", 2: "rgb(var(--af-ink-2-rgb) / <alpha-value>)" },
        paper: "rgb(var(--af-paper-rgb) / <alpha-value>)",
        wall: "rgb(var(--af-wall-rgb) / <alpha-value>)",
        line: "rgb(var(--af-line-rgb) / <alpha-value>)",
        gallery: "rgb(var(--af-gallery-rgb) / <alpha-value>)",
        scan: { DEFAULT: "rgb(var(--af-scan-rgb) / <alpha-value>)", soft: "rgb(var(--af-scan-soft-rgb) / <alpha-value>)" },
        sticker: "rgb(var(--af-sticker-rgb) / <alpha-value>)",
        coral: "rgb(var(--af-coral-rgb) / <alpha-value>)",
        earned: { DEFAULT: "rgb(var(--af-earned-rgb) / <alpha-value>)", soft: "rgb(var(--af-earned-soft-rgb) / <alpha-value>)" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        "theme-primary": {
          DEFAULT: "#15161b",
          "50": "#f0e8e8",
          "100": "#e1d0d0",
          "200": "#c3a1a1",
          "300": "#a57272",
          "400": "#874343",
          "500": "#691414",
          "600": "#541010",
          "700": "#3f0c0c",
          "800": "#2a0808",
          "900": "#150404",
        },
        "theme-secondary": {
          DEFAULT: "#dd8888",
          "50": "#fcf3f3",
          "100": "#f8e7e7",
          "200": "#f1cfcf",
          "300": "#ebb8b8",
          "400": "#e4a0a0",
          "500": "#dd8888",
          "600": "#b16d6d",
          "700": "#855252",
          "800": "#583636",
          "900": "#2c1b1b",
        },
      },
      // Words in coral (errors, warnings) use a deeper coral: the bright paint is 3.1:1 on white,
      // this is 5.5:1 (WCAG AA). bg-coral, border-coral and dots keep the bright paint.
      textColor: {
        coral: "rgb(var(--af-coral-text-rgb) / <alpha-value>)",
      },
      spacing: {
        header:
          "calc(var(--header-top-height, 35px) + var(--header-middle-height, 100px))",
        "header-scrolled":
          "calc(var(--header-top-height-scrolled, 35px) + var(--header-middle-height-scrolled, 70px))",
        "screen-with-header":
          "calc(100svh - var(--header-top-height, 35px) - var(--header-middle-height, 100px))",
      },
      gridTemplateRows: {
        header:
          "var(--header-top-height, 35px) var(--header-middle-height, 100px)",
        "header-scrolled":
          "var(--header-top-height-scrolled, 35px) var(--header-middle-height-scrolled, 70px)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "infinite-x-scroll": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-100%)" },
        },
        "-infinite-x-scroll": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" },
        },
        "infinite-y-scroll": {
          to: { transform: "translateY(-50%)" },
        },
        "-infinite-y-scroll": {
          from: { transform: "translateY(-50%)" },
          to: { transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "infinite-x-scroll": "infinite-x-scroll 25s linear infinite",
        "-infinite-x-scroll": "-infinite-x-scroll 25s linear infinite",
        "infinite-y-scroll": "infinite-y-scroll 25s linear infinite",
        "-infinite-y-scroll": "-infinite-y-scroll 25s linear infinite",
      },
      dropShadow: {
        primary: "0 0 10px #fff4",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
