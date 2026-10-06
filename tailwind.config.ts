import type { Config } from "tailwindcss";

// Geometria squadrata ovunque: nessun arrotondamento (richiesta: riquadri e pulsanti quadrati).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    borderRadius: { none: "0", DEFAULT: "0", sm: "0", md: "0", lg: "0", xl: "0", "2xl": "0", full: "9999px" },
    extend: {
      colors: {
        brand: { DEFAULT: "#1d4ed8", dark: "#1e3a8a", soft: "#eff4ff" },
        steel: { DEFAULT: "#475569", soft: "#f1f5f9", line: "#d5dbe3" },
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
    },
  },
} satisfies Config;
