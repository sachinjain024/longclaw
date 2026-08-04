import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "dist-perf", "src-tauri/target"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
  {
    // The performance harness is a Node script that also carries code across to
    // the browser inside `page.evaluate`, so both sets of globals are real here.
    files: ["perf/**/*.mjs"],
    languageOptions: {
      globals: {
        HTMLElement: "readonly",
        URLSearchParams: "readonly",
        clearTimeout: "readonly",
        document: "readonly",
        fetch: "readonly",
        getComputedStyle: "readonly",
        navigator: "readonly",
        performance: "readonly",
        process: "readonly",
        requestAnimationFrame: "readonly",
        setTimeout: "readonly",
        window: "readonly",
      },
    },
  },
);
