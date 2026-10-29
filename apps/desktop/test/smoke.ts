import { _electron as electron, expect } from "@playwright/test";
import { resolve, join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  goToContractPay,
  next,
  skip,
  verifySalaryControls,
} from "../../web/test/support/onboarding.ts";

const packagedPath =
  process.platform === "darwin"
    ? `apps/desktop/release/${process.arch === "arm64" ? "mac-arm64" : "mac"}/Apply at Ease.app/Contents/MacOS/Apply at Ease`
    : "apps/desktop/release/win-unpacked/Apply at Ease.exe";
const executablePath =
  process.argv[2] === "--packaged" ? resolve(packagedPath) : process.argv[2];
const testDataDirectory =
  process.env.APPLYATEASE_TEST_DATA_DIR ??
  (await mkdtemp(join(tmpdir(), "applyatease-smoke-")));
const profileArgs = testDataDirectory
  ? [`--user-data-dir=${resolve(testDataDirectory)}`]
  : [];
const application = await electron.launch(
  executablePath
    ? { executablePath, args: profileArgs }
    : { args: [resolve("apps/desktop"), ...profileArgs] },
);
try {
  const page = await application.firstWindow();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(
    page.getByRole("heading", {
      name: /Every opportunity/,
    }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await expect(
    page.getByRole("region", { name: "Job opportunities" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Review", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your application review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review application", exact: true }),
  ).toBeDisabled();
  const boundary = await page.evaluate(async () => ({
    hasRequire: "require" in window,
    hasProcess: "process" in window,
    methods: Object.keys(window.applyatease),
    runtime: await window.applyatease.getRuntime(),
  }));
  expect(boundary.hasRequire).toBe(false);
  expect(boundary.hasProcess).toBe(false);
  expect(boundary.methods.sort()).toEqual([
    "getAuthCapabilities",
    "getAuthUser",
    "getRuntime",
    "onAuthChanged",
    "requestAuth",
    "signOut",
  ]);
  expect(boundary.runtime.platform).toBe(process.platform);
  expect(boundary.runtime.node).toMatch(/^24\./);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`Version ${boundary.runtime.appVersion}`, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Your profile", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Set up your profile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "What’s your next move?" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /See what’s out there/ }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Start with what/ }),
  ).toBeVisible();
  for (const file of [
    process.env.APPLYATEASE_TEST_PDF,
    process.env.APPLYATEASE_TEST_DOCX,
  ].filter((v): v is string => Boolean(v))) {
    await page
      .getByLabel("Choose your CV", { exact: true })
      .setInputFiles(file);
    await page.getByRole("button", { name: "Review CV text" }).click();
    await expect(page.getByLabel("Extracted CV text")).not.toBeEmpty();
    await page.getByRole("button", { name: "Back", exact: true }).click();
  }
  const remove = page.getByRole("button", { name: "Remove CV", exact: true });
  if (await remove.count()) await remove.click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await goToContractPay(page);
  await verifySalaryControls(page);
  await next(page);
  await page
    .getByRole("textbox", { name: "Target amount — exact amount" })
    .fill("40000.125");
  await next(page);
  await skip(page);
  await page.getByRole("button", { name: "Confirm search profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Your next chapter starts here" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "Desktop startup, navigation, isolation, document worker, focused onboarding, exact salary synchronization and resume passed",
  );
} finally {
  await application.close();
  if (!process.env.APPLYATEASE_TEST_DATA_DIR)
    await rm(testDataDirectory, { recursive: true, force: true });
}
