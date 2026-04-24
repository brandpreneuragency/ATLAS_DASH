# System Instructions — Design Spec
**Date:** 2026-04-24

## Goal
Add a global "System Instructions" textarea to the Settings modal that prepends custom text to every agent's system prompt on every AI call, across all providers.

## Decisions
- **Placement:** Own top-level section in SettingsModal, between "AI Models" and "Appearance"
- **Combination:** Prepend before agent's system prompt (global context first, then agent personality)
- **Activation:** Always on when field is non-empty; no toggle
- **Storage:** `aiStore` + `secureStorage` key `'systemInstructions'` — same pattern as `searchConfig`
- **Save:** Explicit Save button with 2-second checkmark feedback; no live-save on keystroke

## Files Changed
| File | Change |
|------|--------|
| `src/stores/aiStore.ts` | Add `systemInstructions: string` state, `saveSystemInstructions` action, load in `loadAISettings` |
| `src/components/modals/SettingsModal.tsx` | Add System Instructions section with textarea + Save button |
| `src/hooks/useStreamingChat.ts` | Prepend `systemInstructions` before `agent.systemPrompt` when non-empty |

## System Content Assembly Order
```
systemInstructions (when non-empty)
\n\n
agent.systemPrompt
\n\n
searchContext (when search is enabled and returns results)
```

## Out of Scope
- Per-agent override of global instructions
- Character limit enforcement
- Markdown rendering preview
