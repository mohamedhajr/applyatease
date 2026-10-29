import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import { resolve } from "node:path";
import type { BetterAuthClientPlugin } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { electronClient, handleDeepLink } from "@better-auth/electron/client";
import { storage } from "@better-auth/electron/storage";
import {
  AuthCapabilities,
  AuthUser,
  desktopAuthScheme,
} from "@applyatease/contracts/auth";
import { Schema } from "effect";
import { isTrustedLocation } from "./security.ts";

export function setupAuthentication(developmentUrl?: string) {
  const authURL = process.env.AUTH_URL || "http://127.0.0.1:4310";
  const webURL = process.env.APP_WEB_URL || "http://127.0.0.1:5173";
  for (const value of [authURL, webURL]) {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash)
      throw new Error(
        "Authentication URLs must not contain credentials, query parameters or fragments.",
      );
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      )
    )
      throw new Error("Authentication requires HTTPS outside localhost.");
  }
  const options = {
    protocol: desktopAuthScheme,
    signInURL: new URL("/sign-in", webURL).href,
    storage: storage({ configName: "authentication" }),
    channelPrefix: "applyatease-auth",
    userImageProxy: { enabled: false },
  };
  const plugin = electronClient(options);
  // Normalize the plugin's explicit undefined options for exact optional types.
  const strictPlugin = {
    ...plugin,
    fetchPlugins: plugin.fetchPlugins.map((item) => ({
      ...item,
      async init(
        url: string,
        request: Parameters<
          NonNullable<
            NonNullable<BetterAuthClientPlugin["fetchPlugins"]>[number]["init"]
          >
        >[1],
      ) {
        const result = await item.init(url, request);
        return {
          url: result.url,
          options: {
            ...request,
            credentials: "omit" as const,
            headers: result.options.headers ?? {},
          },
        };
      },
    })),
  };
  const clientOptions = {
    baseURL: authURL,
    plugins: [strictPlugin],
    fetchOptions: { timeout: 15000 },
  };
  const client = createAuthClient(clientOptions);
  const getWindow = () => BrowserWindow.getAllWindows()[0];
  client.setupMain({ scheme: false, bridges: false, csp: false, getWindow });
  const changed = (error?: string) =>
    getWindow()?.webContents.send("applyatease-auth:changed", error);
  const acceptLink = (url: string) => {
    if (!url.startsWith(`${desktopAuthScheme}:/`) || url.length > 8192) return;
    void app.whenReady().then(async () => {
      try {
        await handleDeepLink({
          $fetch: client.$fetch,
          options,
          url,
          getWindow,
          clientOptions,
        });
        const window = getWindow();
        if (window?.isMinimized()) window.restore();
        window?.show();
        window?.focus();
      } catch {
        changed(
          "Desktop sign-in could not be completed. Reopen sign-in from the app and try again.",
        );
        return;
      }
      changed();
    });
  };
  if (app.isPackaged) app.setAsDefaultProtocolClient(desktopAuthScheme);
  else if (process.defaultApp && process.argv[1])
    app.setAsDefaultProtocolClient(desktopAuthScheme, process.execPath, [
      resolve(process.argv[1]),
    ]);
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on("open-url", (event, url) => {
    event.preventDefault();
    acceptLink(url);
  });
  app.on("second-instance", (_event, argv) => {
    const url = argv.find((value) =>
      value.startsWith(`${desktopAuthScheme}:/`),
    );
    if (url) acceptLink(url);
    getWindow()?.focus();
  });
  const initialURL = process.argv.find((value) =>
    value.startsWith(`${desktopAuthScheme}:/`),
  );
  if (initialURL) acceptLink(initialURL);
  function validate(event: IpcMainInvokeEvent) {
    if (
      !event.senderFrame ||
      event.senderFrame !== event.sender.mainFrame ||
      !isTrustedLocation(event.senderFrame.url, developmentUrl)
    )
      throw new Error("Request denied");
  }
  ipcMain.handle("auth:user", async (event, ...args: unknown[]) => {
    validate(event);
    if (args.length) throw new Error("Request denied");
    const result = await client.getSession();
    if (result.error) throw new Error("Your session could not be checked.");
    return result.data ? Schema.decodeSync(AuthUser)(result.data.user) : null;
  });
  async function capabilities() {
    const response = await fetch(new URL("/api/auth-options", authURL), {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Sign-in is unavailable. Please retry.");
    return Schema.decodeUnknownSync(AuthCapabilities)(await response.json());
  }
  ipcMain.handle("auth:capabilities", async (event, ...args: unknown[]) => {
    validate(event);
    if (args.length) throw new Error("Request denied");
    return capabilities();
  });
  ipcMain.handle("auth:start", async (event, ...args: unknown[]) => {
    validate(event);
    if (args.length) throw new Error("Request denied");
    const available = await capabilities();
    if (!Object.values(available).some(Boolean))
      throw new Error("Sign-in is not configured yet.");
    changed();
    await client.requestAuth();
  });
  ipcMain.handle("auth:sign-out", async (event, ...args: unknown[]) => {
    validate(event);
    if (args.length) throw new Error("Request denied");
    try {
      const result = await client.signOut();
      if (result.error)
        throw new Error("Sign-out could not be completed. Please retry.");
    } finally {
      changed();
    }
  });
}
