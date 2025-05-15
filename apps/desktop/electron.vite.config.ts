import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { builtinModules } from "module";
import { resolve } from "path";

const SENTRY_AUTH_TOKEN =
  "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";

export default defineConfig({
  main: {
    build: {
      minify: true,
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
    plugins: [
      externalizeDepsPlugin(),
      sentryVitePlugin({
        authToken: SENTRY_AUTH_TOKEN,
        org: "triage-hu",
        project: "electron",
      }),
    ],
    resolve: {
      alias: {
        "@renderer": resolve(__dirname, "src/renderer/src"),
      },
    },
  },
  preload: {
    // preload script must output cjs, so we need this override since output format is esm by default
    build: {
      minify: true,
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/preload/index.ts"),
        },
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
      },
      sourcemap: true,
    },
    plugins: [
      externalizeDepsPlugin(),
      // Put the Sentry vite plugin after all other plugins
      sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: "triage-hu",
        project: "electron",
      }),
    ],
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
