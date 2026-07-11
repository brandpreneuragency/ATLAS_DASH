# Add Provider in Center Panel — Design

## Goal

When the user clicks **+ Add Provider** in Settings → Models, show the connect flow in the **center panel** of the reusable page template. Remove the right-side `ConnectProviderDrawer` overlay (scrim + drawer) from this path.

## Decisions

| Topic | Choice |
| --- | --- |
| Placement | Center panel (`reusable-page-template__panel--center`) |
| Architecture | Inline center mode owned by `ModelsSection` (`addProviderOpen`) |
| Left-rail provider / Defaults click while adding | Exit add mode; show that selection; discard in-progress form |
| Cancel / Escape (from preset step) | Close add mode; clear selection (`selectedProviderId = null`); show empty center state |
| Escape on form step | Back to preset list first (same as today’s drawer) |
| Escape / Cancel during in-flight Connect | Ignored until phase returns to idle |
| Success | Close add mode; select new provider; show provider detail |
| Store contract | Unchanged: `connectNewProvider(...)` |

## Behavior

1. **+ Add Provider** sets `addProviderOpen = true`. Center renders the connect UI. Left rail stays visible.
2. While add mode is open, center does **not** show provider detail, Defaults, or the empty state.
3. Clicking a provider row or Defaults clears `addProviderOpen` and shows that view.
4. Cancel or Escape from the preset step: `addProviderOpen = false`, `selectedProviderId = null` → empty center (“No providers configured…” / hint), even if providers exist in the left list.
5. Successful Connect: `onConnected(providerId)` → select that provider, close add mode.
6. Failed Connect: stay on the form with the inline error; do not close; no orphan provider (existing transactional behavior).

## Components

### `ConnectProviderPanel` (refactor of `ConnectProviderDrawer`)

- Keep preset → form → Connect logic, focus management, phase/error/success UI.
- Remove: scrim, fixed right-side drawer chrome, `role="dialog"` / `aria-modal`.
- Props stay controlled: `open`, `onClose`, `onConnected?: (providerId: string) => void`.
- Reset form state when `open` becomes true.
- File may be renamed/moved under settings (e.g. `modelProviders/ConnectProviderPanel.tsx`) or kept in place with a rename; callers update accordingly.
- Delete or stop rendering `ConnectProviderDrawer` for Settings → Models. No remaining drawer entry point for Add Provider.

### `ModelsSection`

- Owns `addProviderOpen` and `selectedProviderId`.
- `centerMain` / `centerHeader` branch:
  - `addProviderOpen` → `centerHeader` title is always “Add Provider”; `centerMain` is `ConnectProviderPanel`
  - else Defaults / `ModelManagementContent` / empty (existing)
- Panel body keeps the form-step back control and Connect/Cancel actions; it does not render a second dialog-style title bar or close (X) control — Cancel and Escape cover dismiss.
- Left-rail provider and Defaults `onClick` handlers clear `addProviderOpen`.
- Apply active style on **+ Add Provider** while `addProviderOpen` is true.
- `handleProviderConnected`: set `selectedProviderId`, set `addProviderOpen = false`.
- Cancel path from panel: `onClose` → `addProviderOpen = false` and `selectedProviderId = null`.

### CSS / i18n

- Reuse existing preset/form control styles (e.g. `.connect-preset-btn`).
- Stop using `.connect-provider-drawer` / `.connect-provider-scrim` for this flow; panel uses center-column scroll/padding.
- Reuse existing i18n keys (`models.addProvider`, `models.chooseProviderType`, etc.). No new product copy required unless a panel-specific label tweak is needed.

## Out of scope

- Provider detail tabs, Defaults content, import/sync, and `aiStore` connect APIs.
- Reintroducing a modal/drawer for Add Provider.
- Changing OpenAI-compatible provider architecture.

## Manual verification

1. Zero providers → Add Provider → center shows presets; no drawer/scrim.
2. With providers → Add Provider → center swaps to connect UI; left list remains.
3. Mid-flow click another provider → that provider’s detail; form discarded.
4. Mid-flow click Defaults → Defaults view; form discarded.
5. Cancel/Escape from presets → empty center; selection cleared.
6. Escape on form → back to presets; second Escape cancels to empty center.
7. Successful Connect → new provider selected in center.
8. Failed Connect → error remains in center form; panel stays open.

## Approach rejected

- Sentinel selection id (`__add__`): mixes real IDs with UI mode.
- `variant="inline"` on the existing drawer: keeps dialog/scrim semantics that do not fit a panel.
