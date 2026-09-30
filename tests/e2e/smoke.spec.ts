import { expect, test } from "@playwright/test";

/**
 * Smoke test: a full booking using only a bundled sample car (demo payment),
 * then the in-app email preview. No real money, no real customer data.
 */
test("sample car books end to end and previews the emails", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/#book", { waitUntil: "networkidle" });

  // Step 1 — sample car
  await page.getByRole("button", { name: "Maruti Swift" }).click();
  await expect(page.getByText("Pick your plan")).toBeVisible();

  // Step 2 — plan
  await expect(page.locator("#step-2-body")).toBeVisible({ timeout: 60_000 });
  await page.locator("#step-2-body").getByRole("button", { name: "Essential Wash" }).click();

  // Step 3 — studio, next week (never in the past, rarely full)
  await page.getByRole("radio", { name: "Come to Studio" }).click();
  const free = page.locator("#step-3-body button:not([disabled])").filter({ hasText: /^\d\d:00$/ });
  // Walk forward a week at a time until a week with free capacity shows up.
  for (let week = 0; week < 8; week++) {
    await page.getByRole("button", { name: "Next →" }).click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);
    if ((await free.count()) > 0) break;
  }
  await expect(free.first()).toBeVisible({ timeout: 60_000 });
  // The grid re-renders when the availability query settles, so retry until a pick sticks.
  await expect
    .poll(
      async () => {
        await free
          .first()
          .click({ timeout: 5000 })
          .catch(() => {});
        return page
          .locator("#step-4-body")
          .isVisible()
          .catch(() => false);
      },
      { timeout: 60_000, intervals: [1500] },
    )
    .toBe(true);

  // Step 5 — details + demo payment
  await page.getByRole("button", { name: "Pay & confirm" }).click();
  await page.getByLabel("Your name").fill("Smoke Test");
  await page.getByLabel("WhatsApp number").fill("+91 98320 12345");
  await page.getByLabel("Email (for your reveal video)").fill("smoke@example.com");
  await page.locator("#step-5-body").getByRole("button", { name: "Deposit" }).click();
  await expect(page.getByText("Demo payment - no real money").first()).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Pay Rs." }).click();

  await expect(page.getByRole("heading", { name: "You're Booked" })).toBeVisible({
    timeout: 60_000,
  });

  // Email preview
  await page.getByRole("button", { name: "Preview your emails" }).click();
  await expect(page.locator("iframe")).toBeVisible({ timeout: 30_000 });

  expect(errors).toEqual([]);
});

test("owner dashboard loads for a guest", async ({ page }) => {
  await page.goto("/owner", { waitUntil: "networkidle" });
  await expect(page.getByText("Guest demo")).toBeVisible();
  await expect(page.getByRole("tab", { name: /Route/ })).toBeVisible({ timeout: 60_000 });
});
