import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3110);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const pwLibs = path.join(
  process.env.HOME ?? "/home/admin",
  ".local/pw-libs/usr/lib/x86_64-linux-gnu",
);
const pwLibsAlt = path.join(
  process.env.HOME ?? "/home/admin",
  ".local/pw-libs/lib/x86_64-linux-gnu",
);
const ldPath = [pwLibs, pwLibsAlt, process.env.LD_LIBRARY_PATH]
  .filter(Boolean)
  .join(":");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    launchOptions: {
      env: {
        ...process.env,
        LD_LIBRARY_PATH: ldPath,
      },
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/api/v1/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      AUTH_DEV_BYPASS: "true",
      LD_LIBRARY_PATH: ldPath,
    },
  },
});
