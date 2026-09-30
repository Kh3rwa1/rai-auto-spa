import { expect, test } from "@playwright/test";

/**
 * Nonmutating landing-page checks for the Washbook redesign.
 * Read-only: no uploads, no slots, no payments — only GETs and DOM assertions.
 */

test("hero heading, CTAs and service data", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /Hill-road cars deserve a clear booking/,
  );
  const primary = page.getByRole("link", { name: "Try a demo booking" });
  await expect(primary).toHaveAttribute("href", "#book");
  await expect(page.getByRole("link", { name: "Explore admin demo" })).toHaveAttribute(
    "href",
    "/owner",
  );
  // Services render from PLANS with real prices.
  for (const name of ["Essential Wash", "Full Detail", "Signature Super Design"]) {
    await expect(page.getByRole("article", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.getByText("₹25,000")).toBeVisible();
  // Exactly one booking flow mount.
  await expect(page.locator("#step-1-body")).toHaveCount(1);
  await expect(page.getByText("Use a sample car inside the booking flow")).toBeVisible();
});

test("primary CTA navigates without starting a booking", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Try a demo booking" }).click();
  await expect(page).toHaveURL(/#book$/);
  await expect(page.locator("#step-1-body")).toBeVisible();
  // Nothing auto-started: plan step stays closed.
  await expect(page.locator("#step-2-body")).toBeHidden();
});

test("keyboard users reach booking and admin entrances", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Skip to booking" }).focus();
  await expect(page.getByRole("link", { name: "Skip to booking" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#book$/);
  const admin = page.getByRole("navigation", { name: "Main" }).getByRole("link", {
    name: "Admin demo",
  });
  await admin.focus();
  await expect(admin).toBeFocused();
  await expect(admin).toHaveAttribute("href", "/owner");
});

test("static doodles render with no animation dependency", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  // Complete static SVG artwork is present on first render.
  const stages = page.locator('[data-doodle="true"] > svg');
  await expect(stages.first()).toBeVisible();
  expect(await stages.count()).toBeGreaterThanOrEqual(4);
});

test("reduced motion keeps illustrations and skips the player", async ({ browser }) => {
  const context = await browser.newContext((reducedMotion = "reduce"));
  const page = await context.newPage();
  const playerRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("lottie_light")) playerRequests.push(r.url());
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  expect(playerRequests).toEqual([]);
  await expect(page.locator('[data-doodle="true"] > svg').first()).toBeVisible();
  // Illustrations stay complete; the pause control reflects the calm default.
  await expect(page.getByRole("button", { name: "Play doodles" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await context.close();
});

test("missing player falls back to static artwork", async ({ page }) => {
  await page.route("**/animations/vendor/lottie_light.min.js", (route) => route.abort());
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await expect(page.locator('[data-doodle="true"] > svg').first()).toBeVisible();
  // Page still works: CTA navigates to the booking entrance.
  await page.getByRole("link", { name: "Try a demo booking" }).click();
  await expect(page).toHaveURL(/#book$/);
  await page.unroute("**/animations/vendor/lottie_light.min.js");
});

test("doodle pause control toggles with correct pressed state", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const toggle = page.getByRole("button", { name: /doodles/ });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(page.getByRole("button", { name: "Play doodles" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await toggle.click();
  await expect(page.getByRole("button", { name: "Pause doodles" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });
    // Walk the whole page so lazy artwork mounts, then measure.
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
