import { existsSync, readdirSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:8080";

/**
 * Reuse a Chromium already installed on the machine (CI images, sandboxes) instead of
 * downloading one. Set CHROMIUM_PATH to override; otherwise pick up any /opt/ms-playwright
 * build, which may be a different revision than this @playwright/test version expects.
 */
function findChromium(): string | undefined {
  const explicit = process.env["CHROMIUM_PATH"];
  if (explicit) return explicit;
  const root = "/opt/ms-playwright";
  if (!existsSync(root)) return undefined;
  for (const dir of readdirSync(root)
    .filter((d) => d.startsWith("chromium-"))
    .sort()
    .reverse()) {
    const bin = `${root}/${dir}/chrome-linux/chrome`;
    if (existsSync(bin)) return bin;
  }
  return undefined;
}

const chromiumPath = findChromium();

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env["CI"] ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    viewport: { width: 1280, height: 1800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Keep the tall viewport: Desktop Chrome's 720px height puts plan cards
        // under the sticky header/progress bar, so clicks never become actionable.
        viewport: { width: 1280, height: 1800 },
        ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
      },
    },
  ],
});
