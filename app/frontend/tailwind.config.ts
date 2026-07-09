import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        isb: {
          yellow: "#FFDD00",
          brown: "#3B2800",
          "sand-light": "#FEEAD3",
          "sand-mid": "#FDD5A5",
          terracotta: "#D19571",
          coral: "#F08159",
          blush: "#F8BBAB",
        },
        // Les variables contiennent desormais une valeur de couleur complete
        // (hsl(...), hex, ou rgba(...)) et non plus un triplet HSL nu — ceci
        // pour permettre aux themes sombres declaratifs (palettes hex) de
        // coexister avec les themes clairs derives par teinte (qui ecrivent
        // eux-memes du hsl(...) complet). Ne plus re-envelopper dans hsl().
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        border: "var(--border)",
        ring: "var(--ring)",
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "sans-serif"],
        sans: ['"DM Sans"', "sans-serif"],
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "6px",
      },
      keyframes: {
        "pulse-skeleton": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "pulse-skeleton": "pulse-skeleton 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
