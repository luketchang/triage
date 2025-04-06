import react from "@vitejs/plugin-react";
import { join } from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        index: join(__dirname, "index.html"),
      },
    },
  },
});
