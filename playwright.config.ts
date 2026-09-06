import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
    { name: "phone-safari", use: { ...devices["iPhone 13"] } }
  ],
  webServer: {
    command: "node tests/server.mjs",
    url: "http://127.0.0.1:3100/login",
    timeout: 120_000,
    reuseExistingServer: false
  }
});
