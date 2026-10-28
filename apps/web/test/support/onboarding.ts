import { expect, type Page } from "@playwright/test";
export const next = async (page: Page) =>
  page.getByRole("button", { name: "Continue", exact: true }).click();
export const skip = async (page: Page) =>
  page
    .getByRole("button", { name: "Leave this for later", exact: true })
    .click();

export async function startWithRole(page: Page, title = "DevOps Engineer") {
  await next(page);
  await page.getByRole("button", { name: "Continue without a CV" }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  await next(page);
  await expect(
    page.getByRole("heading", { name: `What level for ${title}?` }),
  ).toBeVisible();
  await skip(page);
  await next(page);
}
export async function goToContractPay(page: Page) {
  await startWithRole(page);
  for (const heading of [
    "Where will you work from?",
    "Where do you currently live?",
    "What’s your time zone?",
    "When can you overlap with a team?",
  ]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await skip(page);
  }
  await page.getByRole("checkbox", { name: /Long-term contract/ }).check();
  await next(page);
  for (const heading of [
    "When could you start?",
    "How do you feel about work travel?",
    "Anything you’d rather avoid?",
  ]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await skip(page);
  }
  await page.getByRole("radio", { name: /Set my pay preferences/ }).check();
  await next(page);
  await page
    .getByRole("searchbox", { name: "Currency", exact: true })
    .fill("AED");
  await page
    .getByRole("searchbox", { name: "Currency", exact: true })
    .press("Enter");
  await next(page);
  await page.getByRole("radio", { name: "Per month", exact: true }).check();
  await next(page);
  await expect(
    page.getByRole("heading", { name: "What’s your private minimum?" }),
  ).toBeVisible();
}
export async function verifySalaryControls(page: Page) {
  const amount = page.getByRole("textbox", {
    name: "Private minimum — exact amount",
    exact: true,
  });
  const slider = page.getByRole("slider", {
    name: "Adjust private minimum",
    exact: true,
  });
  await expect(page.getByRole("textbox")).toHaveCount(1);
  // The range remains usable at its zero endpoint; Continue validates positivity.
  await slider.press("Home");
  await expect(slider).toBeEnabled();
  await slider.press("ArrowRight");
  await expect(amount).toHaveValue("0.01");
  await amount.fill("35000.75");
  await expect(slider).toHaveValue("35000.75");
  await expect(slider).toHaveAttribute("max", "40000");
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(amount).toHaveValue("35000.76");
  await slider.press("ArrowLeft");
  await expect(amount).toHaveValue("35000.75");
  await amount.fill("1234567.89");
  await expect(slider).toHaveValue("1234567.89");
  await expect(slider).toHaveAttribute("max", "1240000");
  await amount.fill("35000.1234567");
  await expect(slider).toBeDisabled();
  await expect(amount).toHaveValue("35000.1234567");
  await amount.fill("35000.125");
  await expect(slider).toBeEnabled();
  await expect(slider).toHaveValue("35000.125");
  await slider.press("ArrowRight");
  await expect(amount).toHaveValue("35000.126");
  await amount.fill("35000.75");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(amount).toHaveValue("35000.75");
  await expect(slider).toHaveValue("35000.75");
}
