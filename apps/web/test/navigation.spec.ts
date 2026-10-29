import { expect, test } from "@playwright/test";

test("uses the opportunity workspace and keeps review separate from approval", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Job opportunities" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Agent conversation" }),
  ).toBeVisible();
  const details = page.getByRole("complementary", {
    name: "Opportunity details",
  });
  await expect(details).toBeVisible();
  await expect(
    page.getByText(
      "Evidence and eligibility are assessed separately against your profile and the full job requirements.",
    ),
  ).toBeVisible();
  await page.getByText("Eligibility", { exact: true }).click();
  await expect(
    page.getByText("Work authorization", { exact: true }),
  ).toBeHidden();
  await page.getByText("Eligibility", { exact: true }).click();
  await expect(
    page.getByText("Work authorization", { exact: true }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Details", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Review", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Your application review" }),
  ).toBeVisible();
  await expect(
    page.getByText("No questions assessed yet", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review application", exact: true }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Close opportunity details" }).click();
  await expect(details).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Career agent", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Show opportunity details", exact: true })
    .click();
  await expect(details).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Review", exact: true }),
  ).toHaveAttribute("aria-selected", "true");

  await expect(
    page.getByRole("button", { name: "Create search plan", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Inspect & import posting", exact: true }),
  ).toBeDisabled();

  await page
    .getByRole("textbox", { name: "Search opportunities" })
    .fill("unmatched search");
  await expect(
    page.getByRole("heading", { name: "No matching opportunities" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.getByRole("button", { name: "Filter opportunities" }).click();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("review");
  await expect(
    page.getByRole("heading", { name: "No opportunities in this view" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(
    page.getByRole("heading", { name: "Your next opportunity starts here" }),
  ).toBeVisible();
});

for (const width of [1440, 1180, 1024, 768, 390, 320]) {
  test(`navigates and adapts panels at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const switcher = page.getByRole("group", { name: "Workspace panels" });
    if (width > 1000) {
      await expect(switcher).toBeHidden();
      const list = await page
        .getByRole("region", { name: "Job opportunities" })
        .boundingBox();
      const chat = await page
        .getByRole("region", { name: "Agent conversation" })
        .boundingBox();
      const details = await page
        .getByRole("complementary", { name: "Opportunity details" })
        .boundingBox();
      expect(list).not.toBeNull();
      expect(chat).not.toBeNull();
      expect(details).not.toBeNull();
      expect(chat!.x).toBeGreaterThan(list!.x + list!.width);
      expect(details!.x).toBeGreaterThan(chat!.x + chat!.width);
      expect(list!.y).toEqual(chat!.y);
      expect(chat!.y).toEqual(details!.y);
    }
    if (width <= 1000) {
      await switcher.getByRole("button", { name: "Chat", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Employer posting URL" })
        .fill("https://example.com/");
      await switcher
        .getByRole("button", { name: "Details", exact: true })
        .click();
      await expect(
        page.getByRole("region", { name: "Agent conversation" }),
      ).toBeHidden();
      await page.getByRole("tab", { name: "Review", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Your application review" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Close opportunity details" })
        .click();
      await expect(
        page.getByRole("textbox", { name: "Employer posting URL" }),
      ).toHaveValue("https://example.com/");
      await expect(
        page.getByRole("heading", { name: "Career agent", exact: true }),
      ).toBeFocused();
      await switcher
        .getByRole("button", { name: "Opportunities", exact: true })
        .click();
    }
    for (const name of [
      "Saved jobs",
      "Needs review",
      "Archived",
      "All opportunities",
    ]) {
      await page.getByRole("link", { name, exact: true }).click();
      await page.reload();
      await expect(
        page.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}
