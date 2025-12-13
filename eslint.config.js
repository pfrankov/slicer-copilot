import js from "@eslint/js";
import globals from "globals";
import sonarjs from "eslint-plugin-sonarjs";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      sonarjs,
    },
    rules: {
      "sonarjs/cognitive-complexity": ["error", 10],
      "max-params": ["error", 3],
      "no-console": "off",
    },
  },
  {
    files: ["test/**/*.js"],
    rules: {
      "max-params": "off",
    },
  },
];
