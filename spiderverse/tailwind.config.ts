import type { Config } from "tailwindcss";

/**
 * Premium design tokens for the Spider-Verse experience.
 * Values mirror the CSS custom properties in app/globals.css so Tailwind
 * utilities and raw CSS stay in lock-step.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#050507", // absolute-ish black canvas
        void: "#0a0a0f", // raised black surfaces
        bone: "#f5f3ee", // off-white type
        ash: "#8a8f98", // muted grey
        web: "#c9ccd4", // web-line grey
        peter: "#e10600", // classic spider-red
        miles: "#ff2d55", // miles red
        volt: "#2de2e6", // electric blue (Miles)
        flux: "#ff2fd0", // neon pink/purple (Miles)
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      fontSize: {
        // Fluid editorial scale (clamp-based — scales mobile → ultrawide)
        "-1": "clamp(0.78rem, 0.72rem + 0.3vw, 0.95rem)",
        "0": "clamp(0.95rem, 0.88rem + 0.35vw, 1.15rem)",
        "1": "clamp(1.15rem, 1rem + 0.8vw, 1.6rem)",
        "2": "clamp(1.5rem, 1.2rem + 1.6vw, 2.6rem)",
        "3": "clamp(2rem, 1.4rem + 3vw, 4rem)",
        "4": "clamp(2.8rem, 1.8rem + 5vw, 6.5rem)",
        "5": "clamp(3.6rem, 2rem + 8vw, 10rem)",
        "6": "clamp(4.5rem, 2rem + 13vw, 16rem)",
      },
      letterSpacing: {
        tightest: "-0.045em",
        wider2: "0.18em",
      },
      transitionTimingFunction: {
        expo: "cubic-bezier(0.16, 1, 0.3, 1)",
        quint: "cubic-bezier(0.83, 0, 0.17, 1)",
        snap: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      boxShadow: {
        glow: "0 0 60px -12px rgba(45,226,230,0.45)",
        "glow-red": "0 0 60px -10px rgba(255,45,85,0.5)",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        tingle: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "25%": { transform: "translate3d(-2%,1%,0) scale(1.01)" },
          "50%": { transform: "translate3d(2%,-1%,0) scale(0.99)" },
          "75%": { transform: "translate3d(-1%,2%,0) scale(1.02)" },
        },
        flicker: {
          "0%,19%,21%,23%,25%,54%,56%,100%": { opacity: "1" },
          "20%,24%,55%": { opacity: "0.4" },
        },
      },
      animation: {
        tingle: "tingle 0.18s steps(2) infinite",
        flicker: "flicker 4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
