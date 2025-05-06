import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    // TODO: should we really be importing renderer code in main?
    resolve: {
      alias: {
        "@renderer": resolve(__dirname, "src/renderer/src"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    // TODO: should we really be importing renderer code in backend?
    resolve: {
      alias: {
        "@renderer": resolve(__dirname, "src/renderer/src"),
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
      },
    },
    plugins: [react()],
  },
});
