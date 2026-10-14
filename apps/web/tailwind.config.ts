import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1E2A27", // texto principal
        muted: "#5A6965", // texto de apoio
        paper: "#F6F8F7", // fundo
        line: "#D5DED9", // bordas
        brand: {
          DEFAULT: "#17694F", // ações e marca
          dark: "#0F5039",
          soft: "#E4EEE8", // painel explicativo
        },
        expense: "#B23A34", // valores de gasto / erros
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
