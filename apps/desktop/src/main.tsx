import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { restoreDevicePreferences } from "./devicePreferences";
import "./styles.css";

// Before the first render, not after it: the appearance is stamped on the root
// and the open project is chosen from what this reads, so a document that
// arrives a tick late is a flash of the wrong theme and a frame of the wrong
// project (`devicePreferences.ts`). It resolves whatever the host answers, so
// nothing here can keep the window from coming up.
await restoreDevicePreferences();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
