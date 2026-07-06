# Acceptance Checklist

## Settings architecture

- [ ] Settings → Tools exists as a Settings sub-tab.
- [ ] No separate route was created.
- [ ] SettingsDocument still renders the settings content.
- [ ] Existing right Settings AI sidebar still works for Models.
- [ ] Existing right Settings AI sidebar still works for Tools.

## Models page

- [ ] Models left panel shows AI/model providers only.
- [ ] Exa is not shown in Models.
- [ ] Tavily is not shown in Models.
- [ ] Firecrawl is not shown in Models.
- [ ] Brave is not shown in Models.
- [ ] Left panel has one clear `+ Add Provider` primary action.
- [ ] Local provider search works.
- [ ] Embeddings empty state is not clickable.
- [ ] Vector Stores empty state is not clickable.
- [ ] Image Models empty state is not clickable.
- [ ] No duplicate connect buttons appear.

## Provider detail panel

- [ ] Selecting a provider updates the center panel.
- [ ] Center panel no longer renders all providers as accordions.
- [ ] Center panel shows only the selected provider.
- [ ] Provider header shows name.
- [ ] Provider header shows status badge.
- [ ] Provider header shows model count.
- [ ] Provider header shows last imported if available.
- [ ] Connection tab exists.
- [ ] Models tab exists.
- [ ] Defaults tab exists.
- [ ] Usage tab exists.
- [ ] Advanced tab exists.

## Status model

- [ ] `connected` is used only when base URL + key + enabled model exist.
- [ ] `needs_key` appears when base URL exists but key is missing.
- [ ] `connection_failed` appears after failed test/import.
- [ ] `sync_needed` appears when key/base URL exist but no imported/enabled model is ready.
- [ ] `needs_setup` appears when required config is missing.
- [ ] Failed import/test does not appear as generic Not connected.

## Connection tab

- [ ] Provider name can be edited/saved.
- [ ] Base URL can be edited/saved.
- [ ] API key can be entered/saved.
- [ ] API key can be shown/hidden without exposing saved raw key unexpectedly.
- [ ] Test connection validates base URL + key without requiring imported models.
- [ ] Sync models calls existing import flow.
- [ ] Errors appear inside the tab.
- [ ] Provider can become connected automatically after valid key + base URL + enabled model.

## Models tab

- [ ] Model search works.
- [ ] Sync Models button exists.
- [ ] Add Custom Model action exists.
- [ ] Filters exist: All, Enabled, Disabled, Custom, Vision, Tool use, Reasoning.
- [ ] Model rows show name.
- [ ] Model rows show ID.
- [ ] Model rows show capabilities.
- [ ] Model rows show source.
- [ ] Model rows show enabled switch.
- [ ] Hidden/enabled models still use current mechanism.
- [ ] Synced models are not deleted by remove action.
- [ ] Custom models can be removed.
- [ ] Imported and custom models coexist.
- [ ] Unknown context/speed/cost/reasoning is shown as Unknown.

## Defaults tab

- [ ] Defaults use `db.settings` with key `modelDefaults`.
- [ ] General chat default exists.
- [ ] Writing default exists.
- [ ] Task management default exists.
- [ ] App management default exists.
- [ ] Coding default exists.
- [ ] Deep reasoning default exists.
- [ ] Fast cheap default exists.
- [ ] Long context default exists.
- [ ] Vision default exists.
- [ ] Structured output default exists.
- [ ] Tool use default exists.
- [ ] Fallback default exists.
- [ ] Existing `activeProviderId` remains compatible.
- [ ] Existing `appManagementProviderId` is migrated or preserved.

## Usage tab

- [ ] Usage tab does not fake provider quota.
- [ ] Unknown token/cost data is shown as Unknown.
- [ ] Estimated cost only appears if pricing/token data exists.
- [ ] Dexie usage table is only added if actual token logging is implemented.

## Advanced tab

- [ ] Provider ID is readonly.
- [ ] Base URL is editable if supported.
- [ ] Custom headers are not implemented unless request/import layers support them.
- [ ] Delete provider uses existing delete method where possible.
- [ ] Delete provider requires confirmation.
- [ ] Raw saved keys are not exposed.

## Tools page

- [ ] Tools page manages Tavily.
- [ ] Tools page manages Exa.
- [ ] Tools page manages Firecrawl.
- [ ] Tools page manages Brave.
- [ ] Tools page uses existing `searchConfig`.
- [ ] Tools page uses existing `saveSearchConfig`.
- [ ] User can set default search provider if existing config supports it.
- [ ] User can enable/disable web search if existing config supports it.
- [ ] Active/not connected status is meaningful.
- [ ] Browser placeholder is non-clickable.
- [ ] Storage placeholder is non-clickable.

## CSS/i18n

- [ ] New styles use tokens.
- [ ] No new visual style is introduced.
- [ ] Avoidable inline styles are removed.
- [ ] EN i18n keys are complete.
- [ ] TR i18n keys are complete.
- [ ] No obvious hardcoded UI strings remain where i18n is expected.

## Validation

- [ ] Typecheck passes, or errors are documented.
- [ ] Lint passes, or errors are documented.
- [ ] Build passes, or errors are documented.
- [ ] Manual Settings → Models test passes.
- [ ] Manual Settings → Tools test passes.
