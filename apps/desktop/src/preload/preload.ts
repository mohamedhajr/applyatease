import type { DesktopBridge } from "@applyatease/contracts/desktop";
import { contextBridge, ipcRenderer } from "electron";

const bridge: DesktopBridge = Object.freeze<DesktopBridge>({
  getAuthCapabilities: () => ipcRenderer.invoke("auth:capabilities"),
  getAuthUser: () => ipcRenderer.invoke("auth:user"),
  requestAuth: () => ipcRenderer.invoke("auth:start"),
  signOut: () => ipcRenderer.invoke("auth:sign-out"),
  onAuthChanged: (callback) => {
    const changed = (_event: Electron.IpcRendererEvent, error: unknown) =>
      callback(typeof error === "string" ? error : undefined);
    ipcRenderer.on("applyatease-auth:changed", changed);
    return () =>
      ipcRenderer.removeListener("applyatease-auth:changed", changed);
  },
  getRuntime: () => ipcRenderer.invoke("desktop:runtime"),
});
contextBridge.exposeInMainWorld("applyatease", bridge);
