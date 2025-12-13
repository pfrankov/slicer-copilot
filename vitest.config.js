import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      reporter: ["text", "lcov"],
      exclude: [
        "src/cli.js",
        "src/3mf/parser.js",
        "src/3mf/writer.js",
        "src/llm/optimizerClient.js",
        "eslint.config.js",
        "vitest.config.js",
        "test/**/*",
        "src/config.js",
        "scripts/**/*",
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
