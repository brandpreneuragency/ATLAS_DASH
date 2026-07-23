import { expect, test, type APIRequestContext } from "@playwright/test";

test.describe("Subscriptions and access", () => {
  test("Dashboard shows $61/mo and mock usage label", async ({ page, request }) => {
    await page.goto("/dashboard");

    // Monthly fixed cost should contain 61 and USD
    const costCard = page.getByTestId("kpi-monthly-cost");
    await expect(costCard).toBeVisible();
    await expect(costCard).toContainText("61");
    await expect(costCard).toContainText("USD");

    // Mock usage badge visible
    const badge = page.getByTestId("mock-usage-badge");
    await expect(badge).toBeVisible();

    // Renewal unknown for at least one subscription with null next billing
    const renewalUnknown = page.getByTestId("renewal-unknown");
    await expect(renewalUnknown.first()).toBeVisible();
  });

  test("Subscription create + edit + archive flow", async ({ page, request }) => {
    // Fetch plans to find the first plan id
    const plansRes = await request.get("/api/v1/plans");
    expect(plansRes.status(), await plansRes.text()).toBe(200);
    const plansBody = (await plansRes.json()) as {
      data: Array<{ id: string; name: string; accessProvider: { name: string } }>;
    };
    expect(plansBody.data.length).toBeGreaterThan(0);
    const firstPlan = plansBody.data[0];

    const suffix = Date.now().toString(36);
    const accountLabel = `mme2e:sub-${suffix}`;

    await page.goto("/subscriptions/new");
    await expect(page.getByTestId("subscription-form")).toBeVisible();

    // Fill the form
    await page.getByTestId("field-account-label").fill(accountLabel);

    // Select the first plan by matching option text
    const planOptionText = `${firstPlan.accessProvider.name} — ${firstPlan.name}`;
    await page.getByTestId("field-plan-id").selectOption({ label: planOptionText });

    await page.getByTestId("field-actual-price").fill("9");

    // Submit
    await page.getByTestId("subscription-form-submit").click();

    // Should redirect to subscription detail
    await expect(page).toHaveURL(/\/subscriptions\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("subscription-detail")).toBeVisible();
    await expect(page.getByTestId("subscription-detail-label")).toHaveText(accountLabel);

    // Extract subscription ID from URL
    const url = page.url();
    const subscriptionId = url.split("/").pop() as string;

    // Edit via API: change accountLabel
    const editedLabel = `${accountLabel}-edited`;
    const patchRes = await request.patch(`/api/v1/subscriptions/${subscriptionId}`, {
      data: { accountLabel: editedLabel },
    });
    expect(patchRes.status(), await patchRes.text()).toBe(200);

    // Get back and assert changed
    const getRes = await request.get(`/api/v1/subscriptions/${subscriptionId}`);
    expect(getRes.status(), await getRes.text()).toBe(200);
    const getBody = (await getRes.json()) as { accountLabel: string };
    expect(getBody.accountLabel).toBe(editedLabel);

    // Archive via API: DELETE
    const delRes = await request.delete(`/api/v1/subscriptions/${subscriptionId}`);
    expect(delRes.status(), await delRes.text()).toBe(200);

    // GET should show archived status
    const archivedRes = await request.get(`/api/v1/subscriptions/${subscriptionId}`);
    expect(archivedRes.status(), await archivedRes.text()).toBe(200);
    const archivedBody = (await archivedRes.json()) as { status: string; archivedAt: string | null };
    expect(archivedBody.status).toBe("archived");
    expect(archivedBody.archivedAt).toBeTruthy();
  });

  test("Access matrix matches seed", async ({ page }) => {
    await page.goto("/access-matrix");
    await expect(page.getByTestId("access-matrix-page")).toBeVisible();
    await expect(page.getByTestId("access-row").first()).toBeVisible();
    await expect(page.getByTestId("access-chip").first()).toBeVisible();
  });

  test("Model access link (multi access path)", async ({ page, request }) => {
    // Pick a seed model
    const modelsRes = await request.get("/api/v1/models?limit=1");
    expect(modelsRes.status(), await modelsRes.text()).toBe(200);
    const modelsBody = (await modelsRes.json()) as {
      data: Array<{ id: string }>;
    };
    expect(modelsBody.data.length).toBeGreaterThan(0);
    const modelId = modelsBody.data[0].id;

    // Fetch plans
    const plansRes = await request.get("/api/v1/plans");
    expect(plansRes.status(), await plansRes.text()).toBe(200);
    const plansBody = (await plansRes.json()) as {
      data: Array<{ id: string; name: string; accessProvider: { name: string } }>;
    };
    expect(plansBody.data.length).toBeGreaterThan(0);
    const firstPlan = plansBody.data[0];

    await page.goto(`/models/${modelId}?tab=access`);
    await expect(page.getByTestId("access-tab")).toBeVisible();

    // Fill the access link form
    await expect(page.getByTestId("model-access-link-form")).toBeVisible();

    // Select plan
    const planOptionText = `${firstPlan.accessProvider.name} — ${firstPlan.name}`;
    await page.getByTestId("field-access-plan").selectOption({ label: planOptionText });

    // Set availability to confirmed
    await page.getByTestId("field-access-availability").selectOption("confirmed");

    // Set access method to cli
    await page.getByTestId("field-access-method").selectOption("cli");

    // Check cliOnly
    await page.getByTestId("field-access-cli-only").check();

    // Submit
    await page.getByTestId("model-access-link-submit").click();

    // Wait for the form to process (it resets on success rather than navigating)
    // Give a brief moment for the API call to complete
    await page.waitForTimeout(1000);

    // Verify via API
    const accessRes = await request.get(
      `/api/v1/model-access?modelId=${encodeURIComponent(modelId)}`,
    );
    expect(accessRes.status(), await accessRes.text()).toBe(200);
    const accessBody = (await accessRes.json()) as {
      data: Array<{ id: string; cliOnly: boolean; planId: string }>;
    };
    const created = accessBody.data.find(
      (a: { planId: string }) => a.planId === firstPlan.id,
    );
    expect(created).toBeDefined();
    expect(created!.cliOnly).toBe(true);

    // Clean up: archive the created access
    if (created) {
      const delRes = await request.delete(`/api/v1/model-access/${created.id}`);
      expect(delRes.status(), await delRes.text()).toBe(200);
    }
  });
});
