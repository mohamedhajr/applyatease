import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({
      status: 401,
      json: { error: "unauthorized" },
    }),
  );
});

test("desktop handoff waits for a verified browser session", async ({
  page,
}) => {
  let unavailable = false;
  await page.route("**/api/session", (route) =>
    route.fulfill({
      status: unavailable ? 503 : 200,
      json: unavailable
        ? { error: "unavailable" }
        : {
            user: {
              id: "handoff-test",
              email: "handoff@example.invalid",
              name: "",
            },
          },
    }),
  );
  await page.route("**/api/auth-options", (route) =>
    route.fulfill({
      json: { email: true, google: false, apple: false },
    }),
  );
  const query = new URLSearchParams({
    client_id: "electron",
    state: "a".repeat(32),
    code_challenge: "b".repeat(43),
  });
  await page.goto(`/sign-in?${query}`);
  const proceed = page.getByRole("button", { name: "Continue", exact: true });
  await expect(proceed).toBeEnabled();
  unavailable = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("alert")).toContainText(
    "session could not be checked",
  );
  await expect(proceed).toBeDisabled();
  unavailable = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(proceed).toBeEnabled();
});

test("sign-in presents three unavailable methods without claiming success", async ({
  page,
}) => {
  await page.route("**/api/auth-options", (route) =>
    route.fulfill({ json: { email: false, google: false, apple: false } }),
  );
  await page.goto("/sign-in");
  await expect(
    page.getByRole("heading", { name: "Your next chapter starts here" }),
  ).toBeVisible();
  for (const name of [
    "Continue with Google",
    "Continue with Apple",
    "Continue with email",
  ])
    await expect(page.getByRole("button", { name })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText(
    "hasn’t been configured",
  );
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Continue with email" }),
    ).toBeVisible();
  }
  await page.getByRole("link", { name: "Back to your profile" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("email form handles delivery and code failures without creating a UI session", async ({
  page,
}) => {
  await page.route("**/api/auth-options", (route) =>
    route.fulfill({ json: { email: true, google: false, apple: false } }),
  );
  let deliveryFails = true;
  // Transport fixtures exercise form states only; API integration tests verify real codes and sessions.
  await page.route("**/api/auth/email-otp/send-verification-otp", (route) =>
    route.fulfill({
      status: deliveryFails ? 503 : 200,
      json: deliveryFails
        ? { message: "Delivery unavailable" }
        : { success: true },
    }),
  );
  await page.route("**/api/auth/sign-in/email-otp", (route) =>
    route.fulfill({ status: 400, json: { message: "Invalid code" } }),
  );
  await page.goto("/sign-in");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("form-test@example.invalid");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await expect(page.getByRole("alert")).toContainText("could not be sent");
  deliveryFails = false;
  await page.getByRole("button", { name: "Continue with email" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your inbox" }),
  ).toBeVisible();
  await expect(page.getByLabel("Verification code")).toBeFocused();
  await expect(
    page.getByRole("button", { name: /Resend code in/ }),
  ).toBeDisabled();
  await page.getByLabel("Verification code").fill("123456");
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await expect(page.getByRole("alert")).toContainText("invalid or expired");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByRole("button", { name: "Use a different email" }).click();
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
    "form-test@example.invalid",
  );
});

test("account UI claims the completed draft and hides it on sign-out (API fixture)", async ({
  page,
}) => {
  let signedIn = false;
  const user = {
    id: "interface-test-account",
    email: "interface-test@example.invalid",
    name: "",
  };
  await page.route("**/api/session", (route) =>
    route.fulfill({
      status: signedIn ? 200 : 401,
      json: signedIn ? { user } : { error: "unauthorized" },
    }),
  );
  await page.route("**/api/auth-options", (route) =>
    route.fulfill({ json: { email: true, google: false, apple: false } }),
  );
  await page.route("**/api/auth/email-otp/send-verification-otp", (route) =>
    route.fulfill({ json: { success: true } }),
  );
  await page.route("**/api/auth/sign-in/email-otp", (route) => {
    signedIn = true;
    return route.fulfill({ json: { user } });
  });
  await page.route("**/api/auth/sign-out", (route) => {
    signedIn = false;
    return route.fulfill({ json: { success: true } });
  });
  await page.goto("/onboarding");
  for (let step = 0; step < 24; step++) {
    if (
      await page
        .getByRole("heading", { name: "Your next chapter, in focus." })
        .isVisible()
    )
      break;
    const withoutCv = page.getByRole("button", {
      name: "Continue without a CV",
    });
    const skip = page.getByRole("button", {
      name: "Leave this for later",
      exact: true,
    });
    if (await withoutCv.isVisible()) await withoutCv.click();
    else if (await skip.isVisible()) await skip.click();
    else if (
      await page
        .getByRole("button", { name: "DevOps Engineer", exact: true })
        .isVisible()
    ) {
      await page
        .getByRole("button", { name: "DevOps Engineer", exact: true })
        .click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
    } else
      await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
  await page.getByRole("button", { name: "Confirm search profile" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Email address", { exact: true }).fill(user.email);
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Verification code").fill("123456");
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  const keys = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("applyatease-profile");
      request.onsuccess = () => resolve(request.result);
    });
    const keys = await new Promise<IDBValidKey[]>((resolve) => {
      const request = db
        .transaction("profile")
        .objectStore("profile")
        .getAllKeys();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return keys;
  });
  expect(keys).toEqual([`user:${user.id}`]);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByText("Sign in after completing your profile."),
  ).toBeVisible();
  await expect(page.getByText(user.email)).toHaveCount(0);
});
