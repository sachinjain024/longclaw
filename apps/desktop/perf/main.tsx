/**
 * The real `App`, mounted the way `src/main.tsx` mounts it, over stubbed Tauri
 * commands that serve a 5,000-ticket project. Everything above the IPC boundary
 * — the store, its fifteen subscriptions, the board — is the shipping code.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../src/App";
import { restoreDevicePreferences } from "../src/devicePreferences";
import { bridge } from "./bridge";
import "../src/styles.css";

window.__longclawPerf = bridge;

// `src/main.tsx` awaits this before it renders, and the harness measures what
// the app does rather than what the harness does: a first render that skipped
// it would be one this app never performs.
await restoreDevicePreferences();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
