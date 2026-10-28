import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  goToContractPay,
  next,
  skip,
  startWithRole,
  verifySalaryControls,
} from "./support/onboarding.ts";

test("focused questions resume, branch and remain individually editable", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await page.getByRole("radio", { name: /See what’s out there/ }).check();
  await next(page);
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Start with what/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: /See what’s out there/ }),
  ).toBeChecked();
  await startWithRole(page, "Video Editor");
  // The interlude is a separate screen immediately before the country question.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Let your work tell the story." }),
  ).toBeVisible();
  await expect(page.locator(".onb-interlude img")).toHaveJSProperty(
    "naturalWidth",
    1536,
  );
  await page.screenshot({
    path: test.info().outputPath("creative-interlude.png"),
    fullPage: true,
    animations: "disabled",
  });
  await next(page);
  for (const title of [
    "Where will you work from?",
    "Where do you currently live?",
    "What’s your time zone?",
    "When can you overlap with a team?",
  ]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(
      page.locator("input:not([type=hidden]), textarea"),
    ).toHaveCount(1);
    await skip(page);
  }
  await page.getByRole("checkbox", { name: /Long-term contract/ }).check();
  await next(page);
  for (const title of [
    "When could you start?",
    "How do you feel about work travel?",
    "Anything you’d rather avoid?",
    "Want to set pay preferences?",
    "Anything your CV doesn’t show?",
  ]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await skip(page);
  }
  await expect(
    page.getByRole("heading", { name: "Your next chapter, in focus." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit Role tracks" }).click();
  await page
    .getByRole("button", { name: "Remove Video Editor", exact: true })
    .click();
  await next(page);
  await expect(page.getByRole("alert")).toContainText(
    "Choose at least one role",
  );
  const search = page.getByRole("searchbox", { name: "Role titles" });
  await search.fill("Platform Engineer");
  await next(page);
  await expect(page.getByRole("alert")).toContainText("add your typed answer");
  await search.press("Enter");
  await page
    .getByRole("button", { name: "DevOps Engineer", exact: true })
    .click();
  await next(page);
  await expect(
    page.getByRole("heading", { name: "What level for Platform Engineer?" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Senior", exact: true }).check();
  await next(page);
  await expect(
    page.getByRole("heading", { name: "What level for DevOps Engineer?" }),
  ).toBeVisible();
  await skip(page);
  await expect(
    page.getByRole("heading", { name: "A direction that’s yours." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to review", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Edit Level · Platform Engineer",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("radio", { name: "Senior", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Back to review", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm search profile" }).click();
  await expect(page.getByText("Search profile saved locally")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Search profile saved locally")).toBeVisible();
  await page.getByRole("link", { name: "Open your workspace" }).click();
  await expect(
    page.getByRole("region", { name: "Job opportunities" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Your profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Clear local profile" }).click();
  await page.getByRole("button", { name: "Remove local profile" }).click();
  await expect(
    page.getByRole("button", { name: "Set up your profile" }),
  ).toBeVisible();
});

test("salary slider preserves exact amounts, validates targets and retains deferred drafts", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await goToContractPay(page);
  await verifySalaryControls(page);
  await page.screenshot({
    path: test.info().outputPath("salary-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`salary-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
  await next(page);
  const target = page.getByRole("textbox", {
    name: "Target amount — exact amount",
  });
  await target.fill("35000.74");
  await next(page);
  await expect(page.getByRole("alert")).toContainText(
    "at least your private minimum",
  );
  await expect(target).toHaveValue("35000.74");
  await target.fill("40000.125");
  await next(page);
  await skip(page);
  await page
    .getByRole("button", {
      name: "Edit Contract (before tax) · private minimum",
      exact: true,
    })
    .click();
  await expect(page.getByRole("textbox")).toHaveValue("35000.75");
  await page.getByRole("textbox").fill("-1");
  await next(page);
  await expect(page.getByRole("alert")).toContainText("positive exact amount");
  await expect(page.getByRole("textbox")).toHaveValue("-1");
  await page.getByRole("textbox").fill("35000.75");
  await page
    .getByRole("button", { name: "Set compensation preferences later" })
    .click();
  await skip(page);
  await expect(
    page.getByText("Left for later; saved drafts are not used"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Compensation preferences", exact: true })
    .click();
  await page.getByRole("radio", { name: /Set my pay preferences/ }).check();
  await next(page);
  await expect(page.getByRole("button", { name: /Remove AED/ })).toBeVisible();
  await next(page);
  await expect(
    page.getByRole("radio", { name: "Per month", exact: true }),
  ).toBeChecked();
  await next(page);
  await expect(page.getByRole("textbox")).toHaveValue("35000.75");
  await next(page);
  await expect(target).toHaveValue("40000.125");
  await page
    .getByRole("button", { name: "Back to review", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm search profile" }).click();
  await expect(page.getByText("Search profile saved locally")).toBeVisible();
});

test("employment and contract pay remain separate when arrangements change", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await goToContractPay(page);
  await page.getByRole("textbox").fill("35000.75");
  await next(page);
  await next(page);
  await skip(page);
  await page
    .getByRole("button", { name: "Edit Work arrangement", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Full-time employment/ }).check();
  await page
    .getByRole("button", { name: "Back to review", exact: true })
    .click();
  // Confirmation returns to the newly added arrangement's first missing answer.
  await page.getByRole("button", { name: "Confirm search profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Which currency should we use?" }),
  ).toBeVisible();
  await expect(
    page.getByText("Full-time employment · gross pay", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Currency", exact: true })
    .fill("USD");
  await page
    .getByRole("searchbox", { name: "Currency", exact: true })
    .press("Enter");
  await next(page);
  await page.getByRole("radio", { name: "Per year", exact: true }).check();
  await next(page);
  await expect(page.getByRole("textbox")).toHaveValue("");
  await expect(
    page.getByText("Full-time employment · gross pay · USD / year", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("textbox").fill("100000.50");
  await next(page);
  await next(page);
  await skip(page);
  await page
    .getByRole("button", {
      name: "Edit Contract (before tax) · private minimum",
      exact: true,
    })
    .click();
  await expect(page.getByRole("textbox")).toHaveValue("35000.75");
  await expect(
    page.getByText(
      "Long-term contract · before tax and expenses · AED / month",
      { exact: true },
    ),
  ).toBeVisible();
});

for (const width of [1440, 768, 390, 320]) {
  test(`onboarding is keyboard operable and fits ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/onboarding");
    const first = page.getByRole("radio", { name: /Find my next role/ });
    await first.focus();
    await page.keyboard.press("Space");
    await expect(first).toBeChecked();
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("radio", { name: /See what’s out there/ }),
    ).toBeChecked();
    await page.screenshot({
      path: test.info().outputPath(`onboarding-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
    await next(page);
    await expect(
      page.getByRole("heading", { name: /Start with what/ }),
    ).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

// Opt-in real-source checks keep personal documents outside the repository.
for (const [kind, input] of [
  ["PDF", process.env.APPLYATEASE_TEST_PDF],
  ["DOCX", process.env.APPLYATEASE_TEST_DOCX],
] as const) {
  test(`extracts and preserves the supplied real ${kind}`, async ({ page }) => {
    test.skip(
      !input,
      `Supply APPLYATEASE_TEST_${kind} with an authorized local CV.`,
    );
    const source = await readFile(input!);
    const expectedHash = createHash("sha256").update(source).digest("hex");
    await page.goto("/onboarding");
    await next(page);
    await page
      .getByLabel("Choose your CV", { exact: true })
      .setInputFiles(input!);
    await page.getByRole("button", { name: "Review CV text" }).click();
    await expect(page.getByLabel("Extracted CV text")).not.toBeEmpty();
    await expect(
      page.getByText("Saved on this device", { exact: true }),
    ).toBeVisible();
    const stored = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open("applyatease-profile", 1);
        r.onsuccess = () => resolve(r.result);
        r.onerror = reject;
      });
      const record = await new Promise<{
        original: Blob;
        profile: { cv: { hash: string } };
      }>((resolve, reject) => {
        const r = db
          .transaction("profile")
          .objectStore("profile")
          .get("current");
        r.onsuccess = () => resolve(r.result);
        r.onerror = reject;
      });
      const bytes = await record.original.arrayBuffer();
      db.close();
      return {
        hash: record.profile.cv.hash,
        byteHash: Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          (b) => b.toString(16).padStart(2, "0"),
        ).join(""),
      };
    });
    expect(stored.hash).toBe(expectedHash);
    expect(stored.byteHash).toBe(expectedHash);
    await page.reload();
    await expect(page.getByLabel("Extracted CV text")).not.toBeEmpty();
    await page
      .getByRole("checkbox", { name: /I’ve checked this text/ })
      .check();
    await next(page);
    await expect(
      page.getByRole("heading", { name: "Anything missing or out of date?" }),
    ).toBeVisible();
    await skip(page);
    await expect(
      page.getByRole("heading", {
        name: "Your experience. Still in your words.",
      }),
    ).toBeVisible();
  });
}

test("detects a competing window before overwriting its answers", async ({
  page,
  context,
}) => {
  await page.goto("/onboarding");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto("/onboarding");
  await expect(
    other.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /See what’s out there/ }).check();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await other.getByRole("radio", { name: /Find my next role/ }).check();
  await expect(other.getByRole("alert")).toContainText(
    "changed in another window",
  );
  await page.reload();
  await expect(
    page.getByRole("radio", { name: /See what’s out there/ }),
  ).toBeChecked();
});
