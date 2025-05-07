/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class", // use dark mode by default
  css: {
    files: ["./src/**/global.css"],
  },
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#ff6a3d",
          light: "#ff8a65",
          dark: "#e85d35",
          transparent: "rgba(255, 106, 61, 0.15)",
          highlight: "rgba(255, 106, 61, 0.08)",
        },
        background: {
          DEFAULT: "#121212",
          lighter: "#1e1e1e",
          alt: "#252525",
          sidebar: "#1a1a1c",
          user: "#252525",
          assistant: "#1e1e1e",
        },
        border: {
          DEFAULT: "#2a2a2a",
          light: "#383838",
          focus: "#444444",
        },
        chat: {
          user: "#202020",
          assistant: "#171717",
        },
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0, 0, 0, 0.2)",
        DEFAULT: "0 1px 3px rgba(0, 0, 0, 0.25), 0 1px 2px rgba(0, 0, 0, 0.4)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.5)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.6)",
      },
      typography: {
        DEFAULT: {
          css: {
            color: "#e0e0e0",
            a: {
              color: "inherit",
              opacity: 0.7,
              "&:hover": {
                opacity: 1,
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
              fontWeight: "500",
              fontStyle: "italic",
              borderLeft: "3px solid rgba(255, 106, 61, 0.6)",
              paddingLeft: "1rem",
              color: "#cccccc",
            },
            code: {
              color: "#e0e0e0",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              borderRadius: "0.25rem",
              padding: "0.25rem",
            },
          },
        },
      },
      fontFamily: {
        sans: ["Inter var", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
    },
  },
  plugins: [import("@tailwindcss/typography")],
};
