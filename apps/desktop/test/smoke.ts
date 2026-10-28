import { _electron as electron, expect } from "@playwright/test";
import { resolve } from "node:path";

const packagedPath =
  process.platform === "darwin"
    ? `apps/desktop/release/${process.arch === "arm64" ? "mac-arm64" : "mac"}/Apply at Ease.app/Contents/MacOS/Apply at Ease`
    : "apps/desktop/release/win-unpacked/Apply at Ease.exe";
const executablePath =
  process.argv[2] === "--packaged" ? resolve(packagedPath) : process.argv[2];
const application = await electron.launch(
  executablePath
    ? { executablePath, args: [] }
    : { args: [resolve("apps/desktop")] },
);
try {
  const page = await application.firstWindow();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(
    page.getByRole("heading", {
      name: "Your next move, with a little more ease.",
    }),
  ).toBeVisible();
  const boundary = await page.evaluate(async () => ({
    hasRequire: "require" in window,
    hasProcess: "process" in window,
    methods: Object.keys(window.applyatease),
    runtime: await window.applyatease.getRuntime(),
  }));
  expect(boundary.hasRequire).toBe(false);
  expect(boundary.hasProcess).toBe(false);
  expect(boundary.methods).toEqual(["getRuntime"]);
  expect(boundary.runtime.platform).toBe(process.platform);
  expect(boundary.runtime.node).toMatch(/^24\./);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`Version ${boundary.runtime.appVersion}`, { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "Desktop startup, navigation, isolation and utility worker passed",
  );
} finally {
  await application.close();
}
