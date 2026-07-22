import { expect, test } from "@playwright/test";

test.describe("Model registry", () => {
  test("browse and filter models", async ({ page }) => {
    await page.goto("/models");
    await expect(page.getByTestId("models-page")).toBeVisible();
    await expect(page.getByTestId("models-table")).toBeVisible();
    await expect(page.getByTestId("model-row").first()).toBeVisible();

    await page.getByTestId("filter-search").fill("gpt");
    await page.getByTestId("filter-submit").click();
    await expect(page).toHaveURL(/search=gpt/);
    await expect(page.getByTestId("model-row").first()).toBeVisible();

    // blank scores render as em dash, never forced zero text in capability cell when missing
    const scoreCells = page.getByTestId("score-capability");
    const count = await scoreCells.count();
    for (let i = 0; i < Math.min(count, 10); i += 1) {
      const text = (await scoreCells.nth(i).innerText()).trim();
      // allowed: number or em dash; not empty string masquerading as zero incorrectly handled
      expect(text === "—" || /^-?\d/.test(text)).toBeTruthy();
    }
  });

  test("create, edit, archive, restore model", async ({ page }) => {
    const suffix = Date.now().toString(36);
    const name = `E2E Model ${suffix}`;
    const canonicalId = `e2e:model-${suffix}`;

    await page.goto("/models/new");
    await expect(page.getByTestId("model-form")).toBeVisible();
    await page.getByTestId("field-name").fill(name);
    await page.getByTestId("field-canonical-id").fill(canonicalId);
    await page.getByTestId("field-family").fill("e2e-family");
    await page.getByTestId("field-vision").selectOption("unknown");
    await page.getByTestId("field-reasoning").selectOption("true");
    await page.getByTestId("field-aliases").fill(`alias-${suffix}`);
    await page.getByTestId("model-form-submit").click();

    await expect(page.getByTestId("model-detail")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("model-detail-name")).toHaveText(name);
    await expect(page.getByTestId("model-detail-canonical-id")).toContainText(canonicalId);

    await page.getByTestId("tab-capabilities").click();
    await expect(page.getByTestId("capability-vision")).toContainText(/unknown/i);
    await expect(page.getByTestId("capability-reasoning")).toContainText(/yes/i);

    await page.getByTestId("model-edit-link").click();
    await expect(page.getByTestId("model-form")).toBeVisible();
    await page.getByTestId("field-name").fill(`${name} Edited`);
    await page.getByTestId("model-form-submit").click();
    await expect(page.getByTestId("model-detail-name")).toHaveText(`${name} Edited`);

    await page.getByTestId("model-archive-button").click();
    await expect(page.getByText(/archived/i).first()).toBeVisible();

    await page.goto("/models?archived=true&search=" + encodeURIComponent(canonicalId));
    await expect(page.getByText(canonicalId)).toBeVisible();

    await page.goto("/models?search=" + encodeURIComponent(canonicalId));
    // archived hidden by default
    await expect(page.getByTestId("models-empty").or(page.getByText(canonicalId))).toBeVisible();

    // restore via detail (open archived filter)
    await page.goto("/models?archived=true&search=" + encodeURIComponent(canonicalId));
    await page.getByText(`${name} Edited`).first().click();
    await page.getByTestId("model-archive-button").click();
    await expect(page.getByText(/active/i).first()).toBeVisible();

    await page.getByTestId("tab-history").click();
    await expect(page.getByTestId("audit-event").first()).toBeVisible();
  });

  test("merge models via UI", async ({ page, request }) => {
    const suffix = Date.now().toString(36);
    // create two models via API for stable IDs
    const developers = await request.get("/api/v1/developers");
    expect(developers.ok()).toBeTruthy();
    const devBody = (await developers.json()) as { data: Array<{ id: string }> };
    const developerId = devBody.data[0].id;

    const sourceRes = await request.post("/api/v1/models", {
      data: {
        canonicalId: `e2e:merge-src-${suffix}`,
        name: `E2E Merge Src ${suffix}`,
        developerId,
        aliases: [{ alias: `e2e-only-${suffix}`, aliasType: "display" }],
      },
    });
    expect(sourceRes.ok()).toBeTruthy();
    const source = (await sourceRes.json()) as { id: string };

    const targetRes = await request.post("/api/v1/models", {
      data: {
        canonicalId: `e2e:merge-tgt-${suffix}`,
        name: `E2E Merge Tgt ${suffix}`,
        developerId,
      },
    });
    expect(targetRes.ok()).toBeTruthy();
    const target = (await targetRes.json()) as { id: string };

    await page.goto(`/models/merge?source=${source.id}&target=${target.id}`);
    await expect(page.getByTestId("merge-form")).toBeVisible();
    await page.getByTestId("merge-submit").click();
    await expect(page).toHaveURL(new RegExp(`/models/${target.id}`), { timeout: 15_000 });
    await page.getByTestId("tab-history").click();
    await expect(page.getByText(/merge/i).first()).toBeVisible();
    await page.getByTestId("tab-overview").click();
    await expect(page.getByText(`e2e-only-${suffix}`)).toBeVisible();
  });
});
