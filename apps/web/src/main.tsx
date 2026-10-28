import { App } from "@applyatease/app/App";
import "@applyatease/app/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing");
createRoot(root).render(
  <StrictMode>
    <App platform={{ kind: "web" }} />
  </StrictMode>,
);
