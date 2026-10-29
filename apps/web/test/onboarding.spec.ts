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

test("focused questions resume, omit timezone, and permit an incomplete profile", async ({
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
  await startWithRole(page, "Video Editor");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Let your work tell the story." }),
  ).toBeVisible();
  await expect(page.locator(".onb-interlude img")).toHaveJSProperty(
    "naturalWidth",
    1536,
  );
  await next(page);
  await page.getByRole("checkbox", { name: "Remote", exact: true }).check();
  await next(page);
  await page.getByRole("checkbox", { name: /Long-term contract/ }).check();
  await next(page);
  for (const title of [
    "Where do you currently live?",
    "Where will you work from?",
    "When can you overlap with a team?",
    "When could you start?",
    "Want to set pay preferences?",
  ]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await skip(page);
  }
  await expect(
    page.getByRole("heading", { name: "Your next chapter, in focus." }),
  ).toBeVisible();
  await expect(page.getByText("Time zone", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit Role tracks" }).click();
  const search = page.getByRole("searchbox", { name: "Role titles" });
  await search.fill("Platform Engineer");
  await next(page);
  await expect(page.getByRole("alert")).toContainText("add your typed answer");
  await search.press("Enter");
  await page
    .getByRole("button", { name: "Back to review", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm search profile" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByRole("heading", { name: "Your next chapter starts here" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Resume setup" })).toHaveCount(
    0,
  );
});

test("salary precision, unit reconfirmation and deferred drafts survive reload", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await goToContractPay(page);
  await verifySalaryControls(page);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
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
  await target.fill("40000.125");
  await next(page);
  await page
    .getByRole("button", {
      name: "Edit Long-term contract · private minimum",
      exact: true,
    })
    .click();
  await expect(page.getByRole("textbox")).toHaveValue("35000.75");
  await page.getByRole("textbox").fill("-1");
  await next(page);
  await expect(page.getByRole("alert")).toContainText("positive exact amount");
  await page.getByRole("textbox").fill("35000.75");
  await page
    .getByRole("button", { name: "Set compensation preferences later" })
    .click();
  await expect(
    page.getByText("Left for later; saved drafts are not used"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Compensation preferences", exact: true })
    .click();
  await page.getByRole("radio", { name: /Set my pay preferences/ }).check();
  await next(page);
  await page
    .getByRole("button", { name: "Back to review", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Edit Long-term contract · currency",
      exact: true,
    })
    .click();
  const currency = page.getByRole("searchbox", {
    name: "Currency",
    exact: true,
  });
  await currency.fill("USD");
  await currency.press("Enter");
  await next(page);
  await expect(
    page.getByRole("heading", { name: "What’s your private minimum?" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveValue("35000.75");
  await next(page);
  await expect(target).toHaveValue("40000.125");
  await next(page);
  await page.getByRole("button", { name: "Confirm search profile" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("mixed work modes scope authorization to physical countries", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await startWithRole(page);
  await page.getByRole("checkbox", { name: "Remote", exact: true }).check();
  await page.getByRole("checkbox", { name: "Hybrid", exact: true }).check();
  await next(page);
  await page.getByRole("checkbox", { name: /Part-time employment/ }).check();
  await next(page);
  await skip(page);
  await page.getByRole("button", { name: "Egypt", exact: true }).click();
  await next(page);
  await skip(page);
  await page.getByRole("button", { name: "Germany", exact: true }).click();
  await next(page);
  await expect(
    page.getByRole("heading", {
      name: "What is your work authorization status in Egypt?",
    }),
  ).toBeVisible();
  await page
    .getByRole("radio", {
      name: "Authorized without restrictions",
      exact: true,
    })
    .check();
  await next(page);
  await expect(
    page.getByRole("heading", {
      name: "What is your work authorization status in Germany?",
    }),
  ).toBeVisible();
  await page
    .getByRole("radio", { name: "Not currently authorized", exact: true })
    .check();
  await next(page);
  await expect(
    page.getByRole("heading", {
      name: "Would you need sponsorship now in Germany?",
    }),
  ).toBeVisible();
  await skip(page);
  await expect(
    page.getByRole("heading", { name: "When could you start?" }),
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
    await page.getByRole("button", { name: "Continue to CV insights" }).click();
    await page
      .getByText("View original and extracted text", { exact: true })
      .click();
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
    await page
      .getByText("View original and extracted text", { exact: true })
      .click();
    await expect(page.getByLabel("Extracted CV text")).not.toBeEmpty();
    await next(page);
    await expect(
      page.getByRole("heading", { name: "What kind of work feels right?" }),
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
