const path = require("path");
const { nodeConfig } = require("./packages/eslint-config/src/node");

/** @type {import("eslint").Linter.FlatConfig[]} */
const rootConfig = [
  ...nodeConfig.filter((config) => !config.plugins?.onlyWarn),
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.turbo/**"],
    languageOptions: {
      parserOptions: {
        project: ["**/tsconfig.json"],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "no-console": ["error", { allow: ["warn", "error", "info"] }],
      "@typescript-eslint/no-explicit-any": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "no-debugger": "error",
      "no-alert": "error",
      "no-process-exit": "error",
    },
  },
];

module.exports = rootConfig;
