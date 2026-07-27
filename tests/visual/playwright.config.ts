import { defineConfig, devices } from "@playwright/test";

const BASE = process.env.OOS_VISUAL_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: ".",
  testMatch: ["specs/**/*.spec.ts"],
  outputDir: "./out/test-output",
  reporter: [
    ["html", { outputFolder: "./out/playwright-html", open: "never" }],
    ["json", { outputFile: "./out/playwright.json" }],
    ["list"],
  ],
  use: {
    baseURL: BASE,
    screenshot: "on",
    trace: "retain-on-failure",
    video: "off",
    ignoreHTTPSErrors: false,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "chromium-mobile", use: { ...devices["iPhone 15 Pro"] } },
    { name: "chromium-tablet", use: { ...devices["iPad (gen 7)"] } },
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "webkit-mobile",
      use: { ...devices["iPhone 15 Pro"], browserName: "webkit" },
    },
    {
      name: "webkit-tablet",
      use: { ...devices["iPad (gen 7)"], browserName: "webkit" },
    },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
    {
      name: "pwa-standalone-mobile",
      use: {
        ...devices["iPhone 15 Pro"],
        browserName: "webkit",
        viewport: { width: 393, height: 852 },
      },
      testMatch: /pwa.*\.spec\.ts/,
    },
  ],
  retries: 0,
  workers: 4,
  timeout: 60_000,
});
