import { defineConfig, devices } from "@playwright/test"

const port = 5178

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1360, height: 860 },
    deviceScaleFactor: 1,
    colorScheme: "light",
  },
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: "chromium" }],
})
