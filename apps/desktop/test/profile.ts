import { _electron as electron, expect } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const testDataDirectory =
  process.env.APPLYATEASE_TEST_DATA_DIR ??
  (await mkdtemp(join(tmpdir(), "applyatease-profile-")));
const packagedPath =
  process.platform === "darwin"
    ? `apps/desktop/release/${process.arch === "arm64" ? "mac-arm64" : "mac"}/Apply at Ease.app/Contents/MacOS/Apply at Ease`
    : "apps/desktop/release/win-unpacked/Apply at Ease.exe";
const profileArgs = [`--user-data-dir=${resolve(testDataDirectory)}`];
const application = await electron.launch(
  process.argv.includes("--packaged")
    ? { executablePath: resolve(packagedPath), args: profileArgs }
    : { args: [resolve("apps/desktop"), ...profileArgs] },
);
try {
  const page = await application.firstWindow();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Your profile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your career snapshot" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Employment", exact: true })
    .click();
  for (const label of [
    "Full-time employment",
    "Part-time employment",
    "Long-term contract",
    "Short-term contract",
    "Internship",
  ])
    await page.getByRole("checkbox", { name: label, exact: true }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page).toHaveURL(/#\/profile$/);
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Edit Employment", exact: true })
    .click();
  for (const label of [
    "Full-time employment",
    "Part-time employment",
    "Long-term contract",
    "Short-term contract",
    "Internship",
  ])
    await expect(
      page.getByRole("checkbox", { name: label, exact: true }),
    ).toBeChecked();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Availability", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Leave for later", exact: true })
    .click();
  await page.getByText("View checklist & edit", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Availability from checklist" }),
  ).toContainText("Left for later");
  if (process.env.APPLYATEASE_PROFILE_SCREENSHOT)
    await page.screenshot({ path: process.env.APPLYATEASE_PROFILE_SCREENSHOT });
  if (process.env.APPLYATEASE_TEST_PDF) {
    await page
      .getByRole("button", { name: "Edit Your original CV", exact: true })
      .click();
    await page
      .getByLabel("Choose your CV", { exact: true })
      .setInputFiles(process.env.APPLYATEASE_TEST_PDF);
    await expect(
      page.getByRole("button", { name: "Remove CV", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.getByText("Not analyzed yet", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Saved on this device", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Save original file", exact: true }),
    ).toBeEnabled();
    if (process.env.APPLYATEASE_TEST_ANALYSIS === "1") {
      await page
        .getByRole("button", {
          name: /^(Analyze CV|Retry analysis connection)$/,
        })
        .click();
      await expect(
        page.getByText("Analysis in progress", { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .getByText("Partial analysis", { exact: true })
          .or(page.getByText("Analysis available", { exact: true })),
      ).toBeVisible({ timeout: 210000 });
      await expect(
        page.getByText("AI interpretation · review with your source", {
          exact: true,
        }),
      ).toBeVisible();
      const details = page.getByRole("region", {
        name: "Career details",
        exact: true,
      });
      await expect(details.locator("summary").first()).toBeVisible();
      await details.locator("summary").first().click();
      await details
        .getByRole("button", { name: "Correct detail", exact: true })
        .first()
        .click();
      await expect(details.getByRole("textbox").first()).not.toBeEmpty();
      await details
        .getByRole("button", { name: "Cancel", exact: true })
        .first()
        .click();
      await page
        .getByRole("heading", {
          name: "Your experience. Your next move.",
          exact: true,
        })
        .scrollIntoViewIfNeeded();
      if (process.env.APPLYATEASE_ANALYSIS_SCREENSHOT)
        await page.screenshot({
          path: process.env.APPLYATEASE_ANALYSIS_SCREENSHOT,
        });
      if (process.env.APPLYATEASE_TEST_DOCX) {
        await page
          .getByRole("button", { name: "Replace CV", exact: true })
          .click();
        await page
          .getByLabel("Choose your CV", { exact: true })
          .setInputFiles(process.env.APPLYATEASE_TEST_DOCX);
        await page.getByRole("button", { name: "Done", exact: true }).click();
        await expect(
          page.getByText("Not analyzed yet", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("AI interpretation · review with your source", {
            exact: true,
          }),
        ).toHaveCount(0);
        await page
          .getByRole("button", { name: "Edit Employment", exact: true })
          .click();
        await expect(
          page.getByRole("checkbox", {
            name: "Short-term contract",
            exact: true,
          }),
        ).toBeChecked();
        await page.getByRole("button", { name: "Done", exact: true }).click();
      }
      console.log(
        "Real CV analysis rendered in the desktop profile; evidence editing opened and cancelled; replacement invalidated analysis and retained preferences.",
      );
    }
  }
  expect(errors).toEqual([]);
  console.log(
    "Desktop profile edits, five employment preferences, reload persistence and optional real CV retention passed.",
  );
} finally {
  await application.close();
  if (!process.env.APPLYATEASE_TEST_DATA_DIR)
    await rm(testDataDirectory, { recursive: true, force: true });
}
