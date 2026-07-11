# Settings Models Least-Friction UX Implementation Plan

> Handoff for the implementing agent. Execute the tasks in order, preserve unrelated worktree changes, and verify provider networking in the Tauri runtime before calling the work complete.

## Goal

Make Settings -> Models a low-friction provider setup and maintenance surface:

`Add Provider -> choose preset or Custom -> enter required credentials -> Connect -> use imported models`

The Add Provider control must work with zero, one, or many existing providers. A successful connection must select the new provider and leave it ready for use. A failed connection must stay in context, explain the failure, and must not silently leave an orphan provider.

## Product decisions

- Keep the current OpenAI-compatible provider architecture. Do not reintroduce native provider-specific streaming paths as part of this work.
- Use one guided primary setup action: **Connect** validates the endpoint, imports the initial models, verifies credential persistence, saves the provider, and selects it.
- Keep **Sync models** as a separate maintenance action after a provider has been connected. Do not show a second setup action that performs the same request.
- Keep credential persistence explicit and verified. Do not silently autosave API-key edits.
- Autosave ordinary model visibility/capability changes and show lightweight saved feedback.
- Treat `hiddenModels` as the canonical model-availability source. `ModelItem.enabled` must not independently decide whether a model is selectable.
- Show only implemented product surfaces. Hide unfinished Usage, Embeddings, Vector Store, Image Models, request-timeout, and custom-header placeholders.
- Use the provider store as the canonical provider list. Local component state should contain only the currently edited form values, not a cloned provider array.
- Preserve manual custom-model entry as the recovery path for compatible endpoints that cannot return `/models`.

## Current defects to remove

1. `src/components/settings/ModelsSection.tsx` handles Add Provider by setting `focusProviderId` to `null`.
2. `src/components/settings/ModelsContent.tsx` interprets `null` as all providers and renders the first provider, so the Add Provider drawer does not open.
3. The drawer-open state lives inside `ModelsContent`, while the Add Provider control lives in its parent.
4. The only working drawer opener is inside the zero-provider empty state, which creates a second-click flow.
5. `ConnectProviderDrawer` creates and persists a provider before validating/importing it, then closes even when import fails.
6. Test Connection and Sync Models both call `importProviderModels`; the dedicated `connectProvider` store action is not used by the page.
7. The center detail renders a one-time `draftProviders` snapshot while refresh, delete, URL updates, and tool toggles mutate the store, allowing stale or overwritten UI.
8. Provider name, status, refresh, Base URL, and save concepts are repeated across multiple headers, tabs, and the footer.
9. Defaults is global but appears inside every provider; Usage renders only unavailable data; Advanced duplicates Base URL and shows unfinished controls.
10. The Models tab exposes seven filters, six columns, two toolbar actions, and technical reasoning controls on every row before the user needs them.

## Scope and file map

| Action | File | Responsibility |
| --- | --- | --- |
| Modify | `src/components/settings/ModelsSection.tsx` | Own provider selection and Add Provider drawer state; simplify the left rail |
| Refactor | `src/components/settings/ModelsContent.tsx` | Remove cloned provider-array state; render the selected provider or global Defaults |
| Modify | `src/components/modals/modelProvider/ConnectProviderDrawer.tsx` | Preset/custom setup form, transactional Connect behavior, inline errors |
| Create | `src/components/settings/modelProviders/providerPresets.ts` | Supported preset metadata; no network or persistence logic |
| Modify | `src/components/settings/modelProviders/ProviderDetailPanel.tsx` | One provider header and only actionable navigation |
| Modify | `src/components/settings/modelProviders/ProviderConnectionTab.tsx` | Connected summary, Edit/Reconnect flow, one clear primary action |
| Modify | `src/components/settings/modelProviders/ProviderModelsTab.tsx` | Progressive-disclosure model list |
| Modify | `src/components/settings/modelProviders/ProviderDefaultsTab.tsx` | Global defaults view using canonical enabled models |
| Modify/delete | `src/components/settings/modelProviders/ProviderTabs.tsx` | Reduce provider tabs to Connection and Models |
| Stop rendering; leave unreferenced if safer | `ProviderUsageTab.tsx`, `ProviderAdvancedTab.tsx` | Remove placeholder/duplicated surfaces from the UX |
| Stop rendering; preserve the existing file diff | `src/components/modals/modelProvider/ModalFooter.tsx` | Remove the conflicting global Save Settings footer from this page |
| Modify | `src/stores/aiStore.ts` | Transactional create/connect contract and canonical model/provider updates |
| Modify | `src/services/ai/importProviderModels.ts` | Reuse normalized validation/import behavior without premature persistence |
| Modify if keyless local support is included | `src/services/ai/openai.ts`, `src/types/index.ts` | Optional no-auth provider semantics |
| Modify | `src/i18n/en.ts`, `src/i18n/tr.ts` | All new labels, statuses, errors, and accessibility text |
| Modify | `src/components/settings/settings.css` | Sticky add control, simplified detail, responsive model rows |
| Modify narrowly if needed | `src/index.css` | Existing `connect-provider-*` drawer selectors only |

`ModelsSection.tsx`, `ModalFooter.tsx`, `aiStore.ts`, `openai.ts`, `types/index.ts`, `index.css`, and both translation files already have unrelated working-tree edits. Inspect their diffs before changing them and edit only the required hunks. Never reset, replace, or reformat these files wholesale.

## Task 0: Record the live baseline

- [ ] Run `git status --short` and save the list of pre-existing modified/untracked files in the implementation notes.
- [ ] Inspect `git diff` for every in-scope file before editing. Distinguish existing edits from this feature.
- [ ] Run `npm run build` once before implementation and record the exact baseline result.
- [ ] If the baseline build is red, identify whether the error touches this slice. Do not fix unrelated terminal, editor, sidebar, CRM, Forms, or Tauri work.
- [ ] Confirm current callers with:

  ```powershell
  rg -n "ModelManagementContent|ConnectProviderDrawer|connectProvider|addProvider|importProviderModels|ModalFooter|ProviderUsageTab|ProviderAdvancedTab" src
  ```

## Task 1: Fix state ownership and the Add Provider path

**Files:** `ModelsSection.tsx`, `ModelsContent.tsx`, `ConnectProviderDrawer.tsx`

- [ ] Rename `focusProviderId` to `selectedProviderId`; it represents selection only.
- [ ] Add independent `addProviderOpen` state in `ModelsSection`.
- [ ] Make the rail Add Provider control set `addProviderOpen(true)` directly. Add `type="button"`, an accessible label, and remove the duplicated textual `+` when a Plus icon is already present.
- [ ] Use the same callback from the zero-provider empty state. There must be no second CTA with separate behavior.
- [ ] Make drawer state controlled by `ModelsSection`. Either render `ConnectProviderDrawer` beside `SettingsPanels` or pass controlled `open/onOpenChange` props into `ModelManagementContent`; do not keep two independent open states.
- [ ] On successful creation, return the created provider ID/config, close the drawer, set `selectedProviderId` to that ID, and focus the provider detail.
- [ ] Reconcile selection when providers finish loading, are added, or are deleted:
  - keep the current ID if it still exists;
  - otherwise select the first connected provider;
  - otherwise select the first provider;
  - otherwise select no provider and show the empty state.
- [ ] After deleting the selected provider, select a remaining neighbor instead of showing “No providers” while other rows still exist.
- [ ] Do not use `null` as an “add mode” or “show all” sentinel.

**Acceptance check:** Add Provider opens the drawer in one click with zero, one, and multiple providers; success selects the newly created provider.

## Task 2: Introduce one transactional provider connection contract

**Files:** `aiStore.ts`, `importProviderModels.ts`, `ConnectProviderDrawer.tsx`

Create or refactor toward one typed store operation, for example:

```ts
type ConnectProviderInput = {
  name: string;
  baseUrl: string;
  apiKey: string;
  presetId?: string;
};

type ConnectProviderResult =
  | { ok: true; provider: AIProviderConfig }
  | { ok: false; code: ProviderImportErrorCode | 'storage'; error: string };
```

- [ ] Normalize and validate the Base URL before changing persisted state.
- [ ] Fetch/import the model list before committing a new provider or replacing an existing credential.
- [ ] Select the first imported model when the previous selection is unavailable.
- [ ] Write the API key through `secureStorage`, read it back, and require an exact match before reporting success.
- [ ] Persist the completed provider config only after network validation and secret verification succeed.
- [ ] Set the new provider to `connected`, make it active, persist `activeProviderId`, and update Zustand atomically.
- [ ] If database persistence fails after a new secret was written, remove the newly written secret on a best-effort basis and return a storage error.
- [ ] On auth, URL, network, or empty-response failure, return a typed error and leave the drawer open. Do not call `onConnected` and do not close as if successful.
- [ ] Preserve the previously working config/key when Reconnect with edited values fails.
- [ ] Keep a separate `syncProviderModels(id)` path for already connected providers. It may update models/last-sync metadata, but it must not masquerade as a connection test.
- [ ] Remove or consolidate obsolete `addProvider`, `connectProvider`, and duplicate import wrappers only after `rg` confirms all callers have migrated.
- [ ] Never print, toast, log, or include API keys in errors.

### Manual-model recovery

- [ ] For `empty_response` or a provider that does not expose a compatible `/models` route, keep the failure visible and offer a secondary **Set up manually** action.
- [ ] That action must be explicit. It may save the provider as `sync_needed`, select it, open Models, and focus Add custom model.
- [ ] Do not offer manual continuation for rejected credentials unless the user edits or removes the credential requirement.

## Task 3: Redesign the drawer around progressive disclosure

**Files:** `ConnectProviderDrawer.tsx`, new `providerPresets.ts`, translations, CSS

- [ ] Define presentation-only preset metadata: stable ID, localized label key, default Base URL, and whether the preset is known/verified to work with the current OpenAI-compatible importer.
- [ ] Include only providers/endpoints that can be verified in the native runtime. Always include Custom.
- [ ] First view: compact preset choices plus Custom. Do not present three blank technical fields as the first experience.
- [ ] Known preset: prefill and hide Provider Name/Base URL; initially request only the required credential.
- [ ] Custom: show Name, Base URL, and API key with concise examples. Keep existing URL normalization for pasted `/models` or `/chat/completions` URLs.
- [ ] Primary action text is Connect. While running, show meaningful steps such as “Checking provider…” and “Importing models…”.
- [ ] Success feedback includes the imported count, then closes and focuses the new provider.
- [ ] Failure remains inline next to the relevant field/action. Preserve entered values so retry needs one click.
- [ ] Escape/scrim/Cancel close only when no connection is running. Restore focus to Add Provider after close.
- [ ] Keep password reveal, correct labels, Enter submission, focus order, and a dialog title. Add a focus trap if the drawer remains modal.
- [ ] Move every visible string, including errors and saved/progress labels, into `en.ts` and `tr.ts`.

## Task 4: Simplify the Models information architecture

**Files:** `ModelsSection.tsx`, `ModelsContent.tsx`, `ProviderDetailPanel.tsx`, `ProviderTabs.tsx`, `ProviderDefaultsTab.tsx`, CSS

### Left rail

- [ ] Show only real provider rows and one global **Model defaults** row.
- [ ] Remove Embeddings, Vector Store, and Image Models placeholders until those surfaces are actionable.
- [ ] Put Add Provider in the rail header so it remains visible when the provider list scrolls.
- [ ] Provider rows show name, human-readable status, and enabled/total model count. Do not rely on an inaccessible colored dot alone.
- [ ] Mark the selected row with `aria-current` or equivalent selected-state semantics.

### Center detail

- [ ] Use one provider header containing provider name, truthful status, model count, and a compact overflow menu.
- [ ] Keep only Connection and Models provider tabs.
- [ ] Move global Defaults out of each provider. Selecting the Model defaults rail row renders `ProviderDefaultsTab` as a page-level view.
- [ ] Stop rendering Usage until actual token/cost data exists.
- [ ] Move Delete provider into the header overflow menu and keep the existing two-step confirmation.
- [ ] Keep Base URL only in Connection/Edit connection. Remove the duplicate Advanced copy and unfinished timeout/header controls.
- [ ] Remove the duplicated Models subtitle toolbar and duplicate global refresh icon.
- [ ] A network action labeled Sync models must perform a real model request. Do not label locally derived status recalculation as Refresh connection.

## Task 5: Make connected providers quiet and editable providers explicit

**Files:** `ProviderConnectionTab.tsx`, `ModelsContent.tsx`, `ModalFooter.tsx`

- [ ] For a connected provider, default to a concise summary: Connected, endpoint host, last model sync, and model count.
- [ ] Provide **Edit connection** and **Reconnect** only when needed; do not leave the API key and Base URL permanently expanded.
- [ ] Editing credentials creates a local draft and does not overwrite the working connection until Reconnect succeeds.
- [ ] Remove Test Connection if it performs the same work as Sync/Connect. If retained, it must be genuinely read-only and must not replace models.
- [ ] Remove the permanent Save Settings footer from the inline Models page.
- [ ] Non-secret changes autosave with compact “Saving…”/“Saved” feedback. Credential changes are committed only through Connect/Reconnect with secure read-back verification.
- [ ] Do not delete `ModalFooter.tsx` in this dirty worktree merely because this page stops using it; preserve its existing user modification.

## Task 6: Remove stale cloned provider state

**Files:** `ModelsContent.tsx`, `aiStore.ts`, provider detail/model components

- [ ] Remove the full `draftProviders` clone and the JSON comparison/persist loop around it.
- [ ] Read the provider list and selected provider directly from `useAIStore` selectors.
- [ ] Keep local drafts only for the selected provider's editable Base URL/API key and reset them when selection changes.
- [ ] Load only the selected provider's secret. Guard async secret reads so a late result cannot populate a different provider after fast navigation.
- [ ] Make refresh, delete, custom-model add, model visibility, tool support, reasoning metadata, and sync update the canonical store path.
- [ ] Ensure successful store updates render immediately without manually copying provider arrays back into component state.
- [ ] Remove dead `connectionState`, `importState`, expanded-provider, modal-focus, or autosave code after the new flow no longer uses it.

## Task 7: Simplify model management and unify availability

**Files:** `ProviderModelsTab.tsx`, `ProviderDefaultsTab.tsx`, `aiStore.ts`, CSS

- [ ] Default toolbar: Search, enabled/total count, and one Sync models action.
- [ ] Keep All and Enabled as the visible filters. Put Disabled/Custom/capability filters behind one optional filter menu if they remain useful.
- [ ] Default row: model name, secondary ID, compact capability badges, and one enabled switch.
- [ ] Put Tools and Thinking overrides behind a per-model disclosure/overflow action. Do not render technical parameter editors under every row by default.
- [ ] Put Add custom model near the toolbar or prominently in the no-models recovery state.
- [ ] Persist visibility through `hiddenModels` and `isModelHidden`/`getEnabledModels`.
- [ ] Update Defaults to use the same canonical enabled-model selector. Do not filter by `ModelItem.enabled` independently.
- [ ] If the active/default model becomes hidden or is removed during sync, choose a valid enabled replacement and persist it. If none remain, show a clear no-enabled-model state.
- [ ] Verify AIModelSelector, ModelSwitcher, ChatInput, and any task-default selectors all expose the same connected, non-hidden set.

## Task 8: Optional keyless local-provider support

Do this only after Tasks 1-7 are stable, because `openai.ts`, `types/index.ts`, and `aiStore.ts` already overlap other work.

- [ ] Add a backwards-compatible auth mode such as `authMode?: 'bearer' | 'none'`; missing means `bearer` for existing configs.
- [ ] Mark verified local presets as `none`; Custom defaults to bearer but may expose “No authentication” under Advanced.
- [ ] In model import and chat streaming, require/attach Authorization only for bearer mode.
- [ ] Update status derivation so no-auth providers do not become `needs_key`.
- [ ] Do not create fake/dummy secrets for no-auth providers.
- [ ] Verify a keyless local endpoint in Tauri before exposing the preset.

## Task 9: Styling and responsive behavior

**Files:** `settings.css` and the touched components

- [ ] Preserve the existing two-column Settings layout and neighboring Settings control patterns.
- [ ] Keep the provider rail usable at its minimum configured width; truncate long provider names without hiding status/action meaning.
- [ ] At narrow center widths, collapse model metadata before shrinking the enabled control or causing horizontal page overflow.
- [ ] Keep the drawer within the app viewport with independently scrollable content and a visible action footer.
- [ ] Use existing tokens/classes; do not introduce a parallel color/spacing system.
- [ ] Prefer new Models-page rules in `settings.css`. If the drawer needs changes in `index.css`, patch only the existing `connect-provider-*` block and avoid broad formatting changes.

## Task 10: Verification

### Static gates

- [ ] Run targeted ESLint on every touched TS/TSX file. Record unrelated baseline failures separately.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
- [ ] Run `cargo check` from `src-tauri` and separate unrelated existing Rust failures from this frontend slice.
- [ ] Run `git diff --check`.
- [ ] Review `git diff --stat` and confirm no unrelated user changes were reverted or swept into the feature.

### UI smoke matrix

- [ ] No providers: Add Provider opens the drawer in one click; Cancel leaves no provider/secret.
- [ ] Existing provider: Add Provider still opens the drawer and does not jump to the first provider.
- [ ] Valid provider: Connect verifies, imports models, persists, closes, selects the new provider, and makes a valid model available to chat.
- [ ] Invalid key: drawer stays open, actionable error appears, and no new row/secret is committed.
- [ ] Invalid URL/network failure: same no-orphan behavior; retry preserves the form.
- [ ] Empty/incompatible model list: manual setup is offered only explicitly and focuses Add custom model.
- [ ] Reconnect failure: the previously working provider/key/model remain usable.
- [ ] Sync: model additions/removals update the list without losing custom models or leaving an invalid active model.
- [ ] Delete selected provider: confirmation is required, secret/config are removed, and another valid selection is shown.
- [ ] Toggle model, tools, and thinking; navigate away/back and restart; the visible state remains correct.
- [ ] Defaults contains only connected, non-hidden models.
- [ ] Keyboard: Add, preset choice, fields, Connect, Cancel, tabs, model toggles, disclosure, and delete confirmation are reachable and visibly focused.
- [ ] English and Turkish layouts contain no hardcoded English strings or clipped primary actions.

### Runtime proof

- [ ] Use browser preview only for layout, navigation, local store, and non-network DOM behavior.
- [ ] Verify provider connection/import in `npm run tauri:dev`, because browser CORS behavior is not proof of the native HTTP path.
- [ ] Verify secure write/read-back in the same Tauri runtime used for the connection.
- [ ] Restart that runtime and confirm provider, selected model, model visibility, and credential-backed chat still work.
- [ ] Capture the success state and the failed-connection/no-orphan state without exposing the API key.
- [ ] Do not validate against the installed `C:\Program Files\TABS\tabs.exe` unless a new package containing these source changes has actually been built and installed.

## Definition of done

- Add Provider works in one click from every provider-list state.
- The initial successful setup requires only preset choice, required credential, and Connect for known providers.
- Connection failure never looks like success and does not silently create an orphan provider.
- A newly connected provider is selected, active, persistent, and immediately usable.
- Connection and Sync are distinct; duplicate Test/Sync behavior is gone.
- The page exposes only real provider/default/model functionality, with advanced model controls progressively disclosed.
- Provider/model UI is driven by canonical store state and stays fresh after add, refresh, edit, delete, navigation, and restart.
- Credential persistence retains explicit secure read-after-write verification.
- The touched slice passes its static gates and the core flow is proven in the current Tauri runtime.
- Unrelated worktree changes remain intact.

## Non-goals

- Implementing usage/cost tracking.
- Implementing embeddings, vector stores, or image-model providers.
- Reintroducing removed native Anthropic/Gemini service implementations.
- Redesigning Settings sections other than Models.
- Packaging or publishing an installer unless separately requested.
- Fixing unrelated baseline build/lint failures.
