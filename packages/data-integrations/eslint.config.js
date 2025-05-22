const path = require("path");

const { typescriptCheckedConfig } = require("../eslint-config/src/typescript-checked");

/** @type {import("eslint").Linter.FlatConfig[]} */
module.exports = [
  ...typescriptCheckedConfig,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: path.resolve(__dirname, "tsconfig.json"),
        tsconfigRootDir: __dirname,
      },
    },
  },
];
