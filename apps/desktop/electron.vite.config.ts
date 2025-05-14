import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { builtinModules } from "module";
import { resolve } from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: false, // For easier debugging
      sourcemap: true,
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.ts"),
        },
        output: {
          inlineDynamicImports: false,
          // Ensure all handlers end up in the same chunk
          manualChunks: undefined,
          // Make sure we preserve module structure
          preserveModules: true,
        },
        // Only externalize electron and absolute node module imports
        external: [
          "electron",
          /^[^./].+/, // Everything that doesn't start with . or / (node_modules)
          /^node:.*/,
          ...builtinModules,
          ...builtinModules.map((m) => `node:${m}`),
        ],
        treeshake: {
          moduleSideEffects: true,
        },
      },
    },
    resolve: {
      alias: {
        "@renderer": resolve(__dirname, "src/renderer/src"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    // preload script must output cjs, so we need this override since output format is esm by default
    build: {
      minify: false,
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/preload/index.ts"),
        },
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
      },
    },
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
