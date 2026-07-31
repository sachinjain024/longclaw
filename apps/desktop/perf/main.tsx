/**
 * The real `App`, mounted the way `src/main.tsx` mounts it, over stubbed Tauri
 * commands that serve a 5,000-ticket project. Everything above the IPC boundary
 * — the store, its fifteen subscriptions, the board — is the shipping code.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../src/App";
import { bridge } from "./bridge";
import "../src/styles.css";

window.__longclawPerf = bridge;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
