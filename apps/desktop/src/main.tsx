import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { restoreDevicePreferences } from "./devicePreferences";
import { installZoom, restoreZoom } from "./zoom";
import "./styles.css";

// Before the first render, not after it: the appearance is stamped on the root
// and the open project is chosen from what this reads, so a document that
// arrives a tick late is a flash of the wrong theme and a frame of the wrong
// project (`devicePreferences.ts`). It resolves whatever the host answers, so
// nothing here can keep the window from coming up.
await restoreDevicePreferences();
// The zoom is the same kind of fact and the same kind of flash: a first frame
// at 100% that jumps to the remembered 150% (LC-258c). It reads the level the
// line above restored, so it has to come after it.
await restoreZoom();
installZoom();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
