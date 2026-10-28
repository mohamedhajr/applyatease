import type { DesktopBridge } from "@applyatease/contracts/desktop";
import { contextBridge, ipcRenderer } from "electron";

const bridge: DesktopBridge = Object.freeze({
  getRuntime: () => ipcRenderer.invoke("desktop:runtime"),
});
contextBridge.exposeInMainWorld("applyatease", bridge);
