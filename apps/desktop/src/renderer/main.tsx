import { App } from "@applyatease/app/App";
import "@applyatease/app/styles.css";
import type { DesktopBridge } from "@applyatease/contracts/desktop";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

declare global {
  interface Window {
    readonly applyatease: DesktopBridge;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing");
createRoot(root).render(
  <StrictMode>
    <App
      platform={{ kind: "desktop", bridge: window.applyatease }}
      apiBaseUrl="http://127.0.0.1:4310/api"
    />
  </StrictMode>,
);
