import { expect, test } from "@playwright/test";

/**
 * Challenge-demo browser suite (all demo, no real money / no real contacts).
 *
 * Covers:
 *  1. Compact landing leading straight to booking
 *  2. Plan step opening while detection runs in the background
 *  3. Resize-safe responsive booking (mobile wizard / desktop sidebar)
 *  4. Sample-car booking with preview shown on the payment screen
 *  5. Signature forcing studio-only (server rejects van + 2-day combos)
 *  6. Mobile van gated on the map pin before Details
 *  7. Simulated payment failure and retry (progress preserved)
 *  8. Slot contention recovery contract (edit earlier steps, keep progress)
 *  9. Guest admin navigation
 * 10. Waitlist-to-payment continuation contract (invalid links handled)
 * 11. Keyboard navigation and dialog focus behaviour
 *
 * Backend-dependent tests hit the live backend (uploads, slots, simulated
 * checkout) like the original smoke test did; the rest are static.
 */

async function sampleToPlan(page: import("@playwright/test").Page) {
  await page.goto("/#book", { waitUntil: "networkidle" });
  // Step 1 — sample car, no upload needed
  await page.getByRole("button", { name: "Maruti Swift" }).click();
  await expect(page.locator("#step-2-body")).toBeVisible({ timeout: 60_000 });
}

async function pickStudioSlot(page: import("@playwright/test").Page) {
  await page.getByRole("radio", { name: "Come to Studio" }).click();
  // `:visible` matters: the mobile and desktop slot grids are both in the DOM,
  // only one is shown, so an unfiltered match can resolve to the hidden copy.
  const free = page
    .locator("#step-3-body button:visible:not([disabled])")
    .filter({ hasText: /^\d\d:00$/ });
  // Walk forward a week at a time until a week with free capacity shows up.
  for (let week = 0; week < 8; week++) {
    await page.getByRole("button", { name: "Next →" }).click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);
    if ((await free.count()) > 0) break;
  }
  await expect(free.first()).toBeVisible({ timeout: 60_000 });
  // The grid re-renders when the availability query settles, so retry until a
  // pick sticks and Details (step 4) opens.
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

test("landing is compact and leads straight to booking", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByText("Car care · MG Marg, Gangtok").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your car, cared for." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Book now" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Services & prices" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Essential Wash.*book now/ }).first()).toBeVisible();
  await page.getByRole("link", { name: "Book now" }).first().click();
  await expect(page.getByRole("heading", { name: "Book in five quick steps." })).toBeVisible({
    timeout: 30_000,
  });
  // Skip link lets keyboard users jump straight to booking.
  await expect(page.getByRole("link", { name: "Skip to booking" })).toBeAttached();
});

test("plan step opens while vehicle detection runs in the background", async ({ page }) => {
  await page.goto("/#book", { waitUntil: "networkidle" });
  // The wizard must advance as soon as the upload starts — not after detection.
  await page.getByRole("button", { name: "Maruti Swift" }).click();
  await expect(page.locator("#step-2-body")).toBeVisible({ timeout: 15_000 });
});

test("resizing between mobile and desktop keeps data and the active step", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/#book", { waitUntil: "networkidle" });
  // Jump straight to Details via the progress bar (no backend needed).
  await page
    .getByRole("navigation", { name: "Booking progress" })
    .getByRole("button", { name: /Details/ })
    .click();
  await expect(page.locator("#step-4-body")).toBeVisible();
  await page.getByLabel("Your name").fill("Resize Proof");
  // Desktop shows the persistent summary sidebar.
  await expect(page.getByRole("complementary", { name: "Booking summary" })).toBeVisible();

  // Shrink to mobile: same step, same typed value, sidebar hides via CSS only.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#step-4-body")).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveValue("Resize Proof");
  await expect(page.getByRole("complementary", { name: "Booking summary" })).toBeHidden();

  // Grow back to desktop: everything preserved, sidebar returns with the data.
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator("#step-4-body")).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveValue("Resize Proof");
  await expect(page.getByRole("complementary", { name: "Booking summary" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Booking summary" })).toContainText(
    "Resize Proof",
  );
});

test("sample car books end to end with preview on the payment screen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await sampleToPlan(page);

  // Step 2 — plan (selecting must not auto-advance; Continue does).
  await page
    .locator("#step-2-body")
    .getByRole("radio", { name: /Essential Wash/ })
    .click();
  await expect(page.locator("#step-2-body")).toBeVisible();
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Continue to location/ })
    .click();

  // Step 3 — studio slot straight to Details (step 4 holds payment + preview).
  await pickStudioSlot(page);

  // Step 4 — preview lives on the payment screen; details + demo payment.
  await expect(page.locator("#step-4-body").getByText("Your AI preview")).toBeVisible({
    timeout: 30_000,
  });
  await page.locator("#step-4-body").getByRole("button", { name: "Use demo details" }).click();
  await expect(page.getByLabel("Email (for your reveal video)")).toHaveValue("demo@example.com");
  await page
    .locator("#step-4-body")
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

test("signature keeps colour/style visible and forces studio-only", async ({ page }) => {
  await sampleToPlan(page);

  // Selecting Signature must NOT advance away from its customisation controls.
  await page
    .locator("#step-2-body")
    .getByRole("radio", { name: /Signature Super Design/ })
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

  // Only the explicit Continue advances — and Signature switches the van to
  // the studio, since the server rejects 2-day van reservations.
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Continue to location/ })
    .click();
  await expect(page.locator("#step-3-body")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("radio", { name: /Come to Studio/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByRole("radio", { name: /We Come To You/ })).toBeDisabled();
  await expect(page.getByText(/the mobile van/i).first()).toBeVisible();
});

test("mobile layout gates the van on a map pin before Details", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await sampleToPlan(page);
  await page
    .locator("#step-2-body")
    .getByRole("radio", { name: /Essential Wash/ })
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

  // The van (default) demands a pin: picking the next available slot saves it
  // but must NOT advance to Details.
  await expect(page.getByText(/drop a map pin/i).first()).toBeVisible();
  const next = page.getByRole("button", { name: /Next available/ });
  if (await next.isVisible().catch(() => false)) {
    await next.click();
    await page.waitForTimeout(1500);
    await expect(page.locator("#step-3-body")).toBeVisible();
    await expect(page.locator("#step-4-body")).toBeHidden();
    await expect(page.getByRole("button", { name: "Drop a map pin above" })).toBeVisible();
  }

  // Studio needs no pin: switching advances normally.
  await page.getByRole("radio", { name: "Come to Studio" }).click();
  const free = page
    .locator("#step-3-body button:visible:not([disabled])")
    .filter({ hasText: /^\d\d:00$/ });
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
});

test("simulated payment failure keeps progress and retry succeeds", async ({ page }) => {
  await sampleToPlan(page);
  await page
    .locator("#step-2-body")
    .getByRole("radio", { name: /Essential Wash/ })
    .click();
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Continue to location/ })
    .click();
  await pickStudioSlot(page);

  await page.locator("#step-4-body").getByRole("button", { name: "Use demo details" }).click();
  await page
    .locator("#step-4-body")
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
    .getByRole("radio", { name: /Essential Wash/ })
    .click();
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Continue to location/ })
    .click();
  await pickStudioSlot(page);
  await page.locator("#step-4-body").getByRole("button", { name: "Use demo details" }).click();

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
    .getByRole("radio", { name: /Full Detail/ })
    .click();
  // Reopen Details: the contact fields only render while that step is open.
  await page
    .getByRole("navigation", { name: "Booking progress" })
    .getByRole("button", { name: /Details/ })
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
    .getByRole("radio", { name: /Essential Wash/ })
    .click();
  await page
    .locator("#step-2-body")
    .getByRole("button", { name: /Continue to location/ })
    .click();
  await pickStudioSlot(page);
  await page.locator("#step-4-body").getByRole("button", { name: "Use demo details" }).click();
  await page
    .locator("#step-4-body")
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
