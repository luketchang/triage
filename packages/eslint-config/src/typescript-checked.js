const typescriptPlugin = require("@typescript-eslint/eslint-plugin");
const typescriptParser = require("@typescript-eslint/parser");
const { typescriptConfig } = require("./typescript");

/** @type {import("eslint").Linter.FlatConfig[]} */
const typescriptCheckedConfig = [
  ...typescriptConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: true, // This will use the tsconfig.json file
      },
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
    },
    rules: {
      // Rules that require type checking
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];

module.exports = { typescriptCheckedConfig };
