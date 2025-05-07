const importPlugin = require("eslint-plugin-import");

/** @type {import("eslint").Linter.FlatConfig[]} */
const baseConfig = [
  {
    ignores: ["node_modules/**", "dist/**", "build/**", ".turbo/**"],
  },
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      // Common rules for all projects
      "no-console": ["error", { allow: ["warn", "error", "info"] }],
      "no-debugger": "error",
      "no-alert": "error",
      "no-process-exit": "error",

      // Import rules
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
  },
];

module.exports = { baseConfig };
