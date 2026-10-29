import { expect, test } from "@playwright/test";
import { validateAnalysis } from "../../../packages/contracts/src/career.ts";
import type { Profile } from "../../../packages/app/src/onboarding/model.ts";

// This opt-in check sends only an explicitly supplied, authorized source to a real model.
test("analyzes an authorized real CV through the local model connection", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.APPLYATEASE_TEST_ANALYSIS !== "1" ||
      !process.env.APPLYATEASE_TEST_PDF,
    "Enable real analysis and supply an authorized local CV.",
  );
  test.setTimeout(240000);
  const api = process.env.APPLYATEASE_TEST_ANALYSIS_API;
  if (api)
    await page.route("**/api/cv-analysis**", (route) => {
      const path = new URL(route.request().url()).pathname;
      return route.continue({ url: new URL(path, api).href });
    });
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Choose your CV", { exact: true })
    .setInputFiles(process.env.APPLYATEASE_TEST_PDF!);
  await page.getByRole("button", { name: "Continue to CV insights" }).click();
  const responsePromise = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/cv-analysis" &&
      r.request().method() === "POST",
    { timeout: 200000 },
  );
  await page
    .getByRole("button", {
      name: /Analyze my CV|Retry analysis connection/,
      exact: true,
    })
    .click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const responseValue: unknown = await response.json();
  await expect(
    page.getByRole("button", { name: "Refresh analysis", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  const profile = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("applyatease-profile", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = reject;
    });
    const saved = await new Promise<{ profile: Profile }>((resolve, reject) => {
      const r = db.transaction("profile").objectStore("profile").get("current");
      r.onsuccess = () => resolve(r.result);
      r.onerror = reject;
    });
    db.close();
    return saved.profile;
  });
  expect(profile.analysis.result).not.toBeNull();
  const result = profile.analysis.result!;
  expect(responseValue).toEqual(result);
  expect(result.model).not.toBe("");
  for (const fact of result.facts) expect(fact.id).toMatch(/^[a-f0-9]{64}$/);
  expect(result.snapshot.length).toBeGreaterThan(0);
  expect(result.sourceHash).toBe(profile.cv?.hash);
  validateAnalysis(result, {
    sourceHash: profile.cv!.hash,
    sections: profile.cv!.sections,
    warnings: profile.cv!.warnings,
  });
  expect(profile.analysis.result?.id).toBe(result.id);
  await page.screenshot({
    path: testInfo.outputPath("real-cv-insights.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Refresh analysis", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Do these directions match what you’re looking for?",
    }),
  ).toBeVisible();
  if (result.roles[0])
    await expect(
      page.getByRole("button", { name: result.roles[0].title, exact: true }),
    ).toBeVisible();
  console.log(
    `Real analysis validated: ${result.coverage.length} sections, ${result.facts.length} facts, ${result.roles.length} directions; model ${result.model}.`,
  );
});
