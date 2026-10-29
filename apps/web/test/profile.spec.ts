import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

test("keeps role experience and desired levels independent in focused editors", async ({
  page,
}) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Add or change a direction" }).click();
  await page
    .getByRole("button", { name: "DevOps Engineer", exact: true })
    .click();
  await page.getByRole("button", { name: "Video Editor", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const role = (name: string) =>
    page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await role("DevOps Engineer")
    .getByRole("button", { name: "Edit Your experience", exact: true })
    .click();
  await page.getByRole("radio", { name: "Not sure yet", exact: true }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await role("DevOps Engineer")
    .getByRole("button", { name: "Edit Desired level", exact: true })
    .click();
  await page.getByRole("radio", { name: "Senior", exact: true }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(role("Video Editor")).toContainText("Not provided");
  await expect(role("Video Editor")).not.toContainText("Senior");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(role("DevOps Engineer")).toContainText("Not sure yet");
  await expect(role("DevOps Engineer")).toContainText("Senior");
  await role("DevOps Engineer")
    .getByRole("button", { name: "Remove DevOps Engineer from target roles" })
    .click();
  await page.getByRole("button", { name: "Add or change a direction" }).click();
  await page
    .getByRole("button", { name: "DevOps Engineer", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(role("DevOps Engineer")).toContainText("Senior");
  await page.getByText("View checklist & edit", { exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Edit DevOps Engineer · experience from checklist",
    }),
  ).toContainText("Needs confirmation");
  await page
    .getByRole("button", { name: "Clear local profile", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove local profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Add or change a direction" }).click();
  await page
    .getByRole("button", { name: "DevOps Engineer", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(role("DevOps Engineer")).not.toContainText("Senior");
  await expect(role("DevOps Engineer")).toContainText("Open — not set");
});

test("country answers stay scoped when a physical work country changes", async ({
  page,
}) => {
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Edit Work modes", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "Remote", exact: true }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Employment", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Full-time employment", exact: true })
    .check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const chooseCountry = async (country: string) => {
    await page
      .getByRole("button", { name: "Edit Remote work country", exact: true })
      .click();
    await page
      .getByRole("searchbox", {
        name: "Physical remote-work country",
        exact: true,
      })
      .fill(country);
    await page
      .getByRole("searchbox", {
        name: "Physical remote-work country",
        exact: true,
      })
      .press("Enter");
    await page.getByRole("button", { name: "Done", exact: true }).click();
  };
  await chooseCountry("Egypt");
  await page
    .getByText("Work authorization · 1 country", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Current authorization", exact: true })
    .click();
  await page.getByRole("radio", { name: "Not sure yet", exact: true }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await chooseCountry("Canada");
  await expect(
    page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "Canada", exact: true }),
    }),
  ).toContainText("Not provided");
  await chooseCountry("Egypt");
  await expect(
    page.getByRole("article").filter({
      has: page.getByRole("heading", { name: "Egypt", exact: true }),
    }),
  ).toContainText("Not sure");
  await expect(
    page.getByRole("button", { name: "Edit Sponsorship now", exact: true }),
  ).toHaveCount(0);
});

test("profile pay editing preserves exact amounts and reconfirms changed units without requiring a target", async ({
  page,
}) => {
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Edit Employment", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Short-term contract", exact: true })
    .check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Pay preferences", exact: true })
    .click();
  await page.getByRole("radio", { name: /Set my pay preferences/ }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const setCurrency = async (currency: string) => {
    await page
      .getByRole("button", { name: "Edit Currency", exact: true })
      .click();
    await page
      .getByRole("searchbox", { name: "Currency", exact: true })
      .fill(currency);
    await page
      .getByRole("searchbox", { name: "Currency", exact: true })
      .press("Enter");
    await page.getByRole("button", { name: "Done", exact: true }).click();
  };
  await setCurrency("USD");
  await page.getByRole("button", { name: "Edit Period", exact: true }).click();
  await page.getByRole("radio", { name: "Per hour", exact: true }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Private minimum", exact: true })
    .click();
  await page
    .getByRole("textbox", {
      name: "Private minimum — exact amount",
      exact: true,
    })
    .fill("0.125");
  await expect(
    page.getByRole("slider", { name: "Adjust private minimum", exact: true }),
  ).toHaveValue("0.125");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByText("View checklist & edit", { exact: true }).click();
  const item = page.getByRole("button", {
    name: "Edit Short-term contract · private minimum from checklist",
    exact: true,
  });
  await expect(item.getByText("Provided", { exact: true })).toBeVisible();
  await setCurrency("EUR");
  await expect(item).toContainText("Needs confirmation");
  await page
    .getByRole("button", { name: "Edit Private minimum", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", {
      name: "Private minimum — exact amount",
      exact: true,
    }),
  ).toHaveValue("0.125");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(item.getByText("Provided", { exact: true })).toBeVisible();
  await expect(
    page.getByText("0.125 · EUR / hour", { exact: true }),
  ).toBeVisible();
});

test("rejects a minimum above the saved target without changing either amount", async ({
  page,
}) => {
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Edit Employment", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Long-term contract", exact: true })
    .check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Pay preferences", exact: true })
    .click();
  await page.getByRole("radio", { name: /Set my pay preferences/ }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  for (const [field, label, value] of [
    ["Private minimum", "Private minimum — exact amount", "100.125"],
    ["Optional target", "Target amount — exact amount", "200.125"],
  ] as const) {
    await page
      .getByRole("button", { name: `Edit ${field}`, exact: true })
      .click();
    await page.getByRole("textbox", { name: label, exact: true }).fill(value);
    await page.getByRole("button", { name: "Done", exact: true }).click();
  }
  await page
    .getByRole("button", { name: "Edit Private minimum", exact: true })
    .click();
  const amount = page.getByRole("textbox", {
    name: "Private minimum — exact amount",
    exact: true,
  });
  await amount.fill("300.125");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Your target should be at least your private minimum",
  );
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(amount).toHaveValue("300.125");
  await amount.fill("200.125");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit Optional target", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", {
      name: "Target amount — exact amount",
      exact: true,
    }),
  ).toHaveValue("200.125");
});

test("clearing the profile invalidates an in-flight real PDF import", async ({
  page,
}) => {
  const input = process.env.APPLYATEASE_TEST_PDF;
  test.skip(!input, "Supply APPLYATEASE_TEST_PDF with an authorized local CV.");
  let releaseReader!: () => void;
  let readerRequested!: () => void;
  const readerGate = new Promise<void>((resolve) => {
    releaseReader = resolve;
  });
  const pendingReader = new Promise<void>((resolve) => {
    readerRequested = resolve;
  });
  const readerClosed = new Promise<void>((resolve) => {
    page.on("worker", (worker) => {
      if (worker.url().includes("pdf.worker"))
        worker.on("close", () => resolve());
    });
  });
  await page.route("**/pdf.worker*", async (route) => {
    readerRequested();
    await readerGate;
    await route.continue();
  });
  try {
    await page.goto("/onboarding");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByLabel("Choose your CV", { exact: true })
      .setInputFiles(input!);
    await pendingReader;
    await page.getByRole("link", { name: "Save & exit" }).click();
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Your profile", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Clear local profile", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Remove local profile", exact: true })
      .click();
    await expect(
      page.getByText("Saved on this device", { exact: true }),
    ).toBeVisible();
    releaseReader();
    await readerClosed;
    await expect(page.getByText("No CV added", { exact: true })).toBeVisible();
    await page
      .getByRole("complementary", { name: "Profile progress and source" })
      .getByRole("button", { name: "Add your CV", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Remove CV", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Close editor", exact: true })
      .click();
    await page.reload();
    await expect(page.getByText("No CV added", { exact: true })).toBeVisible();
    const originalCleared = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("applyatease-profile", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = reject;
      });
      const record = await new Promise<{ original: Blob | null }>(
        (resolve, reject) => {
          const request = db
            .transaction("profile")
            .objectStore("profile")
            .get("current");
          request.onsuccess = () => resolve(request.result);
          request.onerror = reject;
        },
      );
      db.close();
      return record.original === null;
    });
    expect(originalCleared).toBe(true);
  } finally {
    releaseReader();
  }
});

test("profile edits stay in place, preserve skipped details and survive reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Your career snapshot" }),
  ).toBeVisible();
  await expect(page.getByText("No CV added", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Availability", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Leave for later", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByText("View checklist & edit", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Availability from checklist" }),
  ).toContainText("Left for later");
  await page
    .getByRole("button", { name: "Edit Work modes", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /^Remote/ }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(
    page.getByRole("button", { name: "Edit Work modes", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Edit Remote work country", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit In-person locations", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Edit Work modes", exact: true })
    .click();
  await expect(page.getByRole("checkbox", { name: /^Remote/ })).toBeChecked();
  await page.getByRole("checkbox", { name: /^Remote/ }).uncheck();
  await page.getByRole("checkbox", { name: /^On-site/ }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Team overlap", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit In-person locations", exact: true }),
  ).toBeVisible();
  await page.getByText("View checklist & edit", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Availability from checklist" }),
  ).toContainText("Left for later");
  await expect(
    page.getByRole("button", {
      name: "Edit Remote team overlap from checklist",
    }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const width of [320, 390, 768, 1440]) {
  test(`profile and focused editor fit ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: "Your profile", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Edit career goal", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`profile-editor-${width}.png`),
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Edit career goal", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("link", { name: "Open workspace", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Job opportunities" }),
    ).toBeVisible();
  });
}

test("imports a real local CV without inventing a successful analysis", async ({
  page,
}) => {
  const cvPath = process.env.APPLYATEASE_TEST_PDF;
  test.skip(
    !cvPath,
    "Provide an authorized real CV through APPLYATEASE_TEST_PDF.",
  );
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Edit Your original CV", exact: true })
    .click();
  await page
    .getByLabel("Choose your CV", { exact: true })
    .setInputFiles(cvPath!);
  await expect(
    page.getByRole("button", { name: "Remove CV", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByText("Not analyzed yet", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save original file", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Save original file", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("AI interpretation · review with your source", {
      exact: true,
    }),
  ).toHaveCount(0);
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save original file", exact: true })
    .click();
  const download = await downloading;
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  const hash = (bytes: Uint8Array) =>
    createHash("sha256").update(bytes).digest("hex");
  expect(hash(await readFile(downloadedPath!))).toEqual(
    hash(await readFile(cvPath!)),
  );
});
