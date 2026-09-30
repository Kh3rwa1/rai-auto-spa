import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:8080";

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
        // Allows reusing a Chromium already present on the machine (CI images, sandboxes)
        // instead of downloading one: CHROMIUM_PATH=/path/to/chrome bun run test:e2e
        ...(process.env["CHROMIUM_PATH"]
          ? { launchOptions: { executablePath: process.env["CHROMIUM_PATH"] } }
          : {}),
      },
    },
  ],
});
