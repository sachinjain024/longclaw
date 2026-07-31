import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Builds the board harness as a plain web page: the app's own bundle with the
 * three Tauri modules swapped for stubs. Production React, because a development
 * build double-renders under StrictMode and would measure work the product never
 * does.
 */
export default defineConfig({
  root: here,
  plugins: [react()],
  resolve: {
    alias: {
      "@tauri-apps/api/core": resolve(here, "stubs/core.ts"),
      "@tauri-apps/api/event": resolve(here, "stubs/event.ts"),
      "@tauri-apps/plugin-dialog": resolve(here, "stubs/dialog.ts"),
    },
  },
  build: {
    outDir: resolve(here, "../dist-perf"),
    emptyOutDir: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
