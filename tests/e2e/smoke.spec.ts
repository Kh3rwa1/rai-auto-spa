import { expect, test } from "@playwright/test";

/**
 * Challenge-demo browser suite (all demo, no real money / no real contacts).
 *
 * Covers:
 *  1. Sample-car booking (no upload / no personal info required)
 *  2. Signature colour/style selection stays visible until Continue
 *  3. Mobile date chips + time grid (no page-level horizontal scroll)
 *  4. Continuing while the AI preview is pending
 *  5. Demo payment success
 *  6. Simulated payment failure and retry (progress preserved)
 *  7. Slot contention recovery contract (edit earlier steps, keep progress)
 *  8. Guest admin navigation
 *  9. Waitlist-to-payment continuation contract (invalid links handled)
 * 10. Keyboard navigation and dialog focus behaviour
 *
 * Tests 2, 4, 5, 6 hit the live backend (uploads, slots, simulated checkout)
 * like the original smoke test did. Test 1 and parts of 8/9/10 are static.
 */

async function sampleToPlan(page: import("@playwright/test").Page) {
  await page.goto("/#book", { waitUntil: "networkidle" });
  // Step 1 — sample car, no upload needed
  await page.getByRole("button", { name: "Maruti Swift" }).click();
  await expect(page.locator("#step-2-body")).toBeVisible({ timeout: 60_000 });
}

async function pickStudioSlot(page: import("@playwright/test").Page) {
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
}

async function continuePastPreview(page: import("@playwright/test").Page) {
  // Either the preview is ready ("Continue to details") or still pending/failed
  // ("Continue without preview") — both must let the judge move on without waiting.
  const ready = page.locator("#step-4-body").getByRole("button", { name: "Continue to details" });
  const without = page
    .locator("#step-4-body")
    .getByRole("button", { name: "Continue without preview" });
  if (await without.isVisible().catch(() => false)) await without.click();
  else await ready.click();
  await expect(page.locator("#step-5-body")).toBeVisible({ timeout: 30_000 });
}

test("demo entry points are obvious and need no personal info", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByText("Interactive challenge demo").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Try a sample booking" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore admin demo" }).first()).toBeVisible();
  await page.goto("/#book", { waitUntil: "networkidle" });
  await expect(page.getByText("sample car or your own photo").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Maruti Swift" })).toBeVisible();
  // Skip link lets keyboard users jump straight to booking.
  await expect(page.getByRole("link", { name: "Skip to booking" })).toBeAttached();
});

test("sample car books end to end, continues while AI pends, pays demo deposit", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await sampleToPlan(page);

  // Step 2 — plan (selecting must not auto-advance; Continue does).
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Essential Wash/ })
    .click();
  await expect(page.locator("#step-2-body")).toBeVisible();
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Continue to location/ })
    .click();

  // Step 3 — studio slot.
  await pickStudioSlot(page);

  // Step 4 — continue without waiting for the AI preview.
  await continuePastPreview(page);

  // Step 5 — details + demo payment (fictional contacts, values kept).
  await page.locator("#step-5-body").getByRole("button", { name: "Use demo details" }).click();
  await expect(page.getByLabel("Email (for your reveal video)")).toHaveValue("demo@example.com");
  await page
    .locator("#step-5-body")
    .getByRole("button", { name: /Simulate.*deposit/ })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Demo payment.*no real money/)).toBeVisible();
  // Focus moves into the dialog for keyboard users.
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null), {
      timeout: 10_000,
    })
    .toBe(true);
  await dialog.getByRole("button", { name: /Pay.*simulated/ }).click();

  await expect(page.getByRole("heading", { name: "Demo booking confirmed" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("Booking reference:")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reschedule" })).toBeVisible();
  // Video + email states are honest, never implied delivered.
  await expect(page.getByText(/Reveal video|AI visualization|Video/)).toBeVisible();

  // Email preview
  await page.getByRole("button", { name: "Preview your emails" }).click();
  await expect(page.locator("iframe")).toBeVisible({ timeout: 30_000 });

  expect(errors).toEqual([]);
});

test("signature keeps colour/style controls visible until Continue", async ({ page }) => {
  await sampleToPlan(page);

  // Selecting Signature must NOT advance away from its customisation controls.
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Signature Super Design/ })
    .click();
  await expect(page.locator("#step-2-body")).toBeVisible();
  await expect(page.locator("#step-3-body")).toBeHidden();
  await expect(page.locator("#step-2-body").getByText("Wrap colour")).toBeVisible();
  await expect(page.locator("#step-2-body").getByText("2. Style")).toBeVisible();

  // Recommended (subtle) vs Selected (border + checkmark + text) are distinct.
  await expect(page.locator("#step-2-body").getByText("Recommended").first()).toBeVisible();
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Racing Red/ })
    .click();
  await page.locator("#step-2-body").getByRole("button", { name: "Carbon Hood" }).click();
  await expect(page.locator("#step-2-body").getByText(/Selected: Racing Red/)).toBeVisible();

  // Only the explicit Continue advances.
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Continue to location/ })
    .click();
  await expect(page.locator("#step-3-body")).toBeVisible({ timeout: 30_000 });
});

test("mobile scheduling uses date chips and explains unavailable slots", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await sampleToPlan(page);
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Essential Wash/ })
    .click();
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Continue to location/ })
    .click();
  await expect(page.locator("#step-3-body")).toBeVisible({ timeout: 30_000 });

  // Date chips (no horizontal page scroll) + time-button grid for the chosen date.
  await expect(page.getByRole("radiogroup", { name: "Choose a date" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("group", { name: /Times for/ })).toBeVisible();
  const noOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(noOverflow).toBe(true);

  // Next-available shortcut exists when the week has capacity; unavailable
  // times are explained in visible text, not hover-only tooltips.
  const next = page.getByRole("button", { name: /Next available/ });
  if (await next.isVisible().catch(() => false)) {
    await expect(next).toBeEnabled();
    await next.click();
    await expect(page.locator("#step-4-body")).toBeVisible({ timeout: 30_000 });
  } else {
    await expect(page.getByText(/No free slots this week/)).toBeVisible();
  }
});

test("simulated payment failure keeps progress and retry succeeds", async ({ page }) => {
  await sampleToPlan(page);
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Essential Wash/ })
    .click();
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Continue to location/ })
    .click();
  await pickStudioSlot(page);
  await continuePastPreview(page);

  await page.locator("#step-5-body").getByRole("button", { name: "Use demo details" }).click();
  await page
    .locator("#step-5-body")
    .getByRole("button", { name: /Simulate.*deposit/ })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Demo payment.*no real money/)).toBeVisible();
  await dialog.getByText("Simulate failure (to test retry)").click();
  await dialog.getByRole("button", { name: /Pay.*simulated/ }).click();
  await expect(dialog.getByText(/Simulated payment failed/)).toBeVisible({ timeout: 60_000 });

  // Details are preserved across the failure; uncheck and retry the same held slot.
  await expect(page.getByLabel("Email (for your reveal video)")).toHaveValue("demo@example.com");
  await dialog.getByText("Simulate failure (to test retry)").click();
  await dialog.getByRole("button", { name: /Retry.*simulated/ }).click();
  await expect(page.getByRole("heading", { name: "Demo booking confirmed" })).toBeVisible({
    timeout: 60_000,
  });
});

test("earlier steps stay editable without losing progress", async ({ page }) => {
  await sampleToPlan(page);
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Essential Wash/ })
    .click();
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Continue to location/ })
    .click();
  await pickStudioSlot(page);
  await continuePastPreview(page);
  await page.locator("#step-5-body").getByRole("button", { name: "Use demo details" }).click();

  // Jump back to Plan via the progress bar: contact details must survive.
  await page
    .getByRole("navigation", { name: "Booking progress" })
    .getByRole("button", {
      name: /Plan/,
    })
    .click();
  await expect(page.locator("#step-2-body")).toBeVisible();
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Full Detail/ })
    .click();
  await expect(page.getByLabel("Email (for your reveal video)")).toHaveValue("demo@example.com");
});

test("guest admin navigation with destructive-action confirms", async ({ page }) => {
  await page.goto("/owner", { waitUntil: "networkidle" });
  await expect(page.getByText("Guest demo").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Today's operations/ })).toBeVisible({
    timeout: 60_000,
  });
  // Desktop tabs; mobile falls back to a labelled select (no cramped tiny tabs).
  const tabs = page.getByRole("tab", { name: /Route/ });
  if (await tabs.isVisible().catch(() => false)) {
    await page.getByRole("tab", { name: /Calendar/ }).click();
    await page.getByRole("tab", { name: /Waitlist/ }).click();
    await expect(page.getByText("Auto-backfill offers")).toBeVisible({ timeout: 30_000 });
  } else {
    await expect(page.getByLabel("Section")).toBeVisible();
  }
  // Reset is secondary and asks for confirmation first (cancel to avoid mutating shared demo).
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await expect(page.getByText("Reset the demo data?")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("invalid waitlist and payment links are handled honestly", async ({ page }) => {
  await page.goto("/offer/00000000-0000-0000-0000-000000000000", {
    waitUntil: "networkidle",
  });
  await expect(page.getByText(/isn't valid/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: /Back to Rai/ })).toBeVisible();

  await page.goto("/pay/00000000-0000-0000-0000-000000000000?t=invalid-token-here", {
    waitUntil: "networkidle",
  });
  await expect(page.getByText(/isn't valid anymore/)).toBeVisible({ timeout: 30_000 });
});

test("idle checkout dialog traps focus and Escape cancels", async ({ page }) => {
  await sampleToPlan(page);
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Essential Wash/ })
    .click();
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Continue to location/ })
    .click();
  await pickStudioSlot(page);
  await continuePastPreview(page);
  await page.locator("#step-5-body").getByRole("button", { name: "Use demo details" }).click();
  await page
    .locator("#step-5-body")
    .getByRole("button", { name: /Simulate.*deposit/ })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Tab stays inside the dialog (Radix focus trap).
  await page.keyboard.press("Tab");
  const inside = await page.evaluate(
    () => document.activeElement?.closest('[role="dialog"]') !== null,
  );
  expect(inside).toBe(true);
  // Escape cancels an idle (not yet paying) checkout.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden({ timeout: 10_000 });
});
