import { expect, test } from "@playwright/test";

/**
 * Real anonymous boundary checks against a server with AUTH_DEV_BYPASS=false.
 * Do not rely on helper unit tests alone — hit HTTP + browser navigation.
 */
test.describe("Auth boundaries (no bypass)", () => {
  test("public health remains reachable anonymously", async ({ request }) => {
    const res = await request.get("/api/v1/health");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  test("login page is public", async ({ page }) => {
    const res = await page.goto("/login");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: /model monitor/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
  });

  test("protected /models redirects anonymous users to /login", async ({ page }) => {
    const res = await page.goto("/models");
    // Next middleware issues a redirect; final URL must be login with callback.
    await expect(page).toHaveURL(/\/login/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("callbackUrl") ?? "").toMatch(/models/);
    // Ensure we did not render the protected models surface.
    await expect(page.getByTestId("models-page")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
    // status should be a redirect chain ending at login (200)
    expect(res?.status()).toBeLessThan(400);
  });

  test("protected JSON API returns structured 401", async ({ request }) => {
    const res = await request.get("/api/v1/models?limit=1");
    expect(res.status()).toBe(401);
    const body = (await res.json()) as {
      error?: { code?: string; message?: string; requestId?: string };
    };
    expect(body.error?.code).toBe("UNAUTHORIZED");
    expect(body.error?.message).toMatch(/auth/i);
    expect(typeof body.error?.requestId).toBe("string");
    expect(body.error?.requestId!.length).toBeGreaterThan(0);
  });

  test("protected model mutation API returns structured 401", async ({ request }) => {
    const res = await request.post("/api/v1/models", {
      data: { canonicalId: "mme2e:should-not-create", name: "Nope" },
    });
    expect(res.status()).toBe(401);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("UNAUTHORIZED");
  });

  test("lookalike private paths enter auth and are denied anonymously", async ({ request }) => {
    async function assertDenied(path: string) {
      const res = await request.get(path, { maxRedirects: 0 });
      const status = res.status();
      // Must be auth evidence or redirect — not a bypassed framework 404 alone without auth headers.
      if (status === 401) {
        const body = (await res.json().catch(() => null)) as {
          error?: { code?: string };
        } | null;
        expect(body?.error?.code).toBe("UNAUTHORIZED");
        return;
      }
      expect([301, 302, 303, 307, 308]).toContain(status);
      const location = res.headers()["location"] ?? "";
      expect(location).toMatch(/\/login/);
    }

    await assertDenied("/_next/image/private");
    await assertDenied("/_next/image-private");
    await assertDenied("/_next/staticx/private");
    await assertDenied("/favicon.ico/private");
  });

  test("exact public asset paths remain outside auth challenge", async ({ request }) => {
    // These may 400/404 from Next itself, but must not be auth redirects/401.
    for (const path of ["/_next/image", "/favicon.ico"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).not.toBe(401);
      const location = res.headers()["location"] ?? "";
      expect(location.includes("/login")).toBe(false);
    }
  });
});
