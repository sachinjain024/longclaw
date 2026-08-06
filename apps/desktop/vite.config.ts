import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // Each suite still declares its own environment with a `@vitest-environment`
  // pragma; this is only what the environment itself fails to provide.
  test: {
    setupFiles: ["./src/testSetup.ts"],
  },
  server: {
    host: host || false,
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
