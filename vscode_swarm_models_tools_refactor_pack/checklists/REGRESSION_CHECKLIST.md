# Manual Regression Checklist

## Settings navigation

1. Open Settings.
2. Click Models.
3. Click Tools.
4. Click Actions, Appearance, Agents.
5. Return to Models.

Expected:

- [ ] No blank screen.
- [ ] No console errors.
- [ ] Right Settings AI sidebar still appears.
- [ ] Active tab styling works.

## Models

1. Search for a provider.
2. Select a provider.
3. Open each tab.
4. Add/edit provider details if test data is safe.
5. Test connection with invalid key.
6. Confirm failed status appears.
7. Test connection with valid key if available.
8. Sync models if safe.
9. Add a custom model slug.
10. Enable/disable a model.
11. Set a default model.
12. Try delete provider and cancel confirmation.

Expected:

- [ ] Invalid connection is visible inside tab.
- [ ] Sync and test are separate.
- [ ] Custom model persists.
- [ ] Synced models are not removed as custom models.
- [ ] Delete requires confirmation.

## Tools

1. Open Tools.
2. Select Tavily.
3. Select Exa.
4. Select Firecrawl.
5. Select Brave.
6. Save API key for a test tool if safe.
7. Toggle web search if available.
8. Set default search provider if available.

Expected:

- [ ] Search tools are not shown under Models.
- [ ] Search config saves through existing state.
- [ ] Active/not connected status updates correctly.
- [ ] Browser/Storage placeholders are not clickable.

## Persistence

1. Refresh/restart app.
2. Reopen Settings → Models.
3. Reopen Settings → Tools.

Expected:

- [ ] Selected defaults persist.
- [ ] Provider models/custom models persist.
- [ ] Search tool config persists.
- [ ] No raw API keys are exposed.
