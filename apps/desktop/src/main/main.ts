import { app, BrowserWindow, ipcMain, net, protocol, session } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isTrustedLocation, resolveAsset } from "./security.ts";
import { startWorker } from "./worker-client.ts";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

const developmentUrl = app.isPackaged
  ? undefined
  : process.env.ELECTRON_RENDERER_URL;
let worker: ReturnType<typeof startWorker> | undefined;

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 760,
    minHeight: 600,
    title: "Apply at Ease",
    backgroundColor: "#faf9f7",
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
    },
  });
  window.removeMenu();
  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedLocation(url, developmentUrl)) event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  void window.loadURL(developmentUrl ?? "app://app/");
}

void app
  .whenReady()
  .then(() => {
    session.defaultSession.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    const policy = `default-src 'self'; script-src 'self'${developmentUrl ? " 'unsafe-inline'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://127.0.0.1:4310${developmentUrl ? " ws://127.0.0.1:5174" : ""}; object-src 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'none'`;
    session.defaultSession.webRequest.onHeadersReceived((details, callback) =>
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [policy],
        },
      }),
    );
    protocol.handle("app", async (request) => {
      const path = resolveAsset(
        join(import.meta.dirname, "../renderer"),
        request.url,
      );
      if (!path || request.method !== "GET")
        return new Response(null, { status: 403 });
      try {
        return await net.fetch(pathToFileURL(path).href);
      } catch {
        return new Response(null, { status: 404 });
      }
    });
    worker = startWorker(
      join(import.meta.dirname, "worker.js"),
      app.getVersion(),
    );
    ipcMain.handle("desktop:runtime", (event, ...args: unknown[]) => {
      if (
        args.length ||
        !event.senderFrame ||
        event.senderFrame !== event.sender.mainFrame ||
        !isTrustedLocation(event.senderFrame.url, developmentUrl)
      )
        throw new Error("Request denied");
      if (!worker) throw new Error("Desktop service is unavailable");
      return worker.getRuntime();
    });
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch(() => {
    app.exit(1);
  });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  worker?.stop();
  ipcMain.removeHandler("desktop:runtime");
});
