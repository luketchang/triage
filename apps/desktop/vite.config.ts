import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  base: "./",
  build: {
    outDir: "dist/renderer",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/renderer/index.html"),
      },
      external: ["electron", "@triage/agent", "@triage/common", "@triage/observability"],
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
    assetsDir: "assets",
    copyPublicDir: true,
  },
});
