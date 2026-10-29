import { expect, test } from "@playwright/test";

test("research setup isolates local profiles and cannot enter applicant confirmation screens", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "New research profile", exact: true })
    .click();
  await page
    .getByLabel("Research profile name", { exact: true })
    .fill("Research boundary check");
  await expect(
    page.getByText("Local research · no applicant authorization", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Your current profile could not be prepared for this workflow.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Analyze research CV", exact: true }),
  ).toBeDisabled();
  for (const path of ["/profile", "/onboarding", "/sign-in"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Research evidence", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirm search profile", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByLabel("Research profile name", { exact: true }),
    ).toHaveValue("Research boundary check");
  }
  await page
    .getByRole("button", { name: "New research profile", exact: true })
    .click();
  await expect(
    page.getByLabel("Research profile name", { exact: true }),
  ).toHaveValue("Research profile 2");
  await page
    .getByLabel("Select workspace", { exact: true })
    .selectOption({ label: "Research boundary check" });
  await expect(
    page.getByLabel("Research profile name", { exact: true }),
  ).toHaveValue("Research boundary check");
  await page.reload();
  await expect(
    page.getByLabel("Research profile name", { exact: true }),
  ).toHaveValue("Research boundary check");
  await page
    .getByRole("button", { name: "Exit research", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Research evidence", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Create search plan", exact: true }),
  ).toBeDisabled();
});
