/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class", // use dark mode by default
  // Add the Tailwind v4 default tailwind.css path
  css: {
    files: ["./src/**/tailwind.css"],
  },
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#ff6a3d",
          light: "#ff8a65",
          dark: "#cc5500",
          transparent: "rgba(255, 106, 61, 0.2)",
          highlight: "rgba(255, 106, 61, 0.1)",
        },
        background: {
          DEFAULT: "#111111",
          lighter: "#1a1a1a",
          sidebar: "#202123",
        },
        border: {
          DEFAULT: "#333333",
          light: "#444654",
        },
        chat: {
          user: "#343541",
          assistant: "#444654",
        },
      },
      typography: {
        DEFAULT: {
          css: {
            color: "#333",
            a: {
              color: "inherit",
              opacity: 0.6,
              "&:hover": {
                opacity: 0.9,
              },
            },
            h1: {
              fontWeight: "700",
              letterSpacing: "-0.025em",
            },
            h2: {
              fontWeight: "700",
              letterSpacing: "-0.025em",
            },
            h3: {
              fontWeight: "600",
              letterSpacing: "-0.025em",
            },
            h4: {
              fontWeight: "600",
              letterSpacing: "-0.025em",
            },
            h5: {
              fontWeight: "600",
              letterSpacing: "-0.025em",
            },
            h6: {
              fontWeight: "600",
              letterSpacing: "-0.025em",
            },
            strong: {
              fontWeight: "700",
            },
            blockquote: {
              fontWeight: "600",
              fontStyle: "italic",
              borderLeft: "4px solid #333",
              paddingLeft: "1rem",
            },
          },
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [import("@tailwindcss/typography")],
};
