# Terminal Toggle → Nav Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the terminal panel toggle from the header into a bottom-pinned button on the left `#nav-bar`.

**Architecture:** Keep the existing `useUIStore` `terminalPanelOpen` / `setTerminalPanelOpen` API. Remove the header button; add an equivalent `nav-btn` in `LeftNarrowSidebar` inside a `nav-section-bottom` section pinned with `margin-top: auto`. Ctrl+J in `App.tsx` stays untouched.

**Tech Stack:** React, Zustand (`useUIStore`), Lucide (`TerminalSquare`), existing `nav-btn` CSS in `src/index.css`.

## Global Constraints

- Do not change terminal panel, PTY, tabs, or height behavior
- Do not change Ctrl/Cmd+J shortcut wiring in `App.tsx`
- Do not change header swap / assistant toggles
- Match existing nav icon size (~15) and `nav-btn` / `nav-btn--on` styling
- Do not create a shared `TerminalToggle` component (YAGNI)
- Do not commit unless the user explicitly asks (project rule)

---

## File map

| File | Role |
|------|------|
| `src/components/header/Header.tsx` | Remove terminal button + unused imports/selectors |
| `src/components/layout/LeftNarrowSidebar.tsx` | Add bottom-pinned `#nav-btn-terminal` |
| `src/index.css` | Ensure `.nav-section-bottom` pins to rail floor via `margin-top: auto` |

Spec: `docs/superpowers/specs/2026-07-16-terminal-toggle-nav-rail-design.md`

---

### Task 1: Pin bottom nav section + add terminal button

**Files:**
- Modify: `src/components/layout/LeftNarrowSidebar.tsx`
- Modify: `src/index.css` (`.nav-section-bottom` block ~2498)

**Interfaces:**
- Consumes: `useUIStore` → `terminalPanelOpen: boolean`, `setTerminalPanelOpen: (v: boolean) => void`
- Produces: `#nav-btn-terminal` in DOM, toggles panel open state

- [x] **Step 1: Update CSS so bottom section sticks to the rail floor**

In `src/index.css`, replace the existing `.nav-section-bottom` rule with:

```css
.nav-section-bottom {
  margin-top: auto;
  justify-content: flex-end;
  padding-bottom: 12px;
  border-top: none;
}
```

- [x] **Step 2: Add terminal toggle to `LeftNarrowSidebar`**

Update imports at the top of `src/components/layout/LeftNarrowSidebar.tsx`:

```tsx
import { ClipboardList, FileText, PanelLeft, TerminalSquare, Users, Settings as SettingsIcon } from 'lucide-react';
```

Inside the component body, add store selectors (with the other `useUIStore` calls):

```tsx
const terminalPanelOpen = useUIStore((s) => s.terminalPanelOpen);
const setTerminalPanelOpen = useUIStore((s) => s.setTerminalPanelOpen);
```

After the mode-button `nav-section` (Documents / Tasks / CRM / Settings), before the closing `</div>` of `#nav-bar`, add:

```tsx
      <div className="nav-section nav-section-bottom">
        <button
          id="nav-btn-terminal"
          type="button"
          onClick={() => setTerminalPanelOpen(!terminalPanelOpen)}
          title={terminalPanelOpen ? 'Hide terminal (Ctrl+J)' : 'Show terminal (Ctrl+J)'}
          aria-label={terminalPanelOpen ? 'Hide terminal' : 'Show terminal'}
          aria-pressed={terminalPanelOpen}
          className={`nav-btn${terminalPanelOpen ? ' nav-btn--on' : ''}`}
        >
          <TerminalSquare size={15} />
        </button>
      </div>
```

- [ ] **Step 3: Manual verify (nav side)**

Run the app (existing `npm` / `tauri` dev script). Confirm:
1. Terminal icon appears at the absolute bottom of `#nav-bar`
2. Click toggles the terminal panel
3. `aria-pressed` / `nav-btn--on` reflect open state
4. Documents / Tasks / CRM / Settings / panel toggle still work

Expected: button only in left rail bottom; panel toggles correctly.

---

### Task 2: Remove terminal button from header

**Files:**
- Modify: `src/components/header/Header.tsx`

**Interfaces:**
- Consumes: none for terminal after this task
- Produces: header `.ai-toggle-col` contains only swap + assistant buttons

- [x] **Step 1: Strip terminal from `Header.tsx`**

Replace the full file contents with:

```tsx
import { ArrowLeftRight, PanelRight } from 'lucide-react';
import { TabBar } from './TabBar';
import { selectCanSwapWrappers, useUIStore } from '../../stores/uiStore';

export function Header() {
  const assistantOpen = useUIStore((s) => s.assistantWrapperOpen);
  const toggleAssistantWrapper = useUIStore((s) => s.toggleAssistantWrapper);
  const wrappersSwapped = useUIStore((s) => s.wrappersSwapped);
  const toggleWrappersSwapped = useUIStore((s) => s.toggleWrappersSwapped);
  const canSwapWrappers = useUIStore(selectCanSwapWrappers);

  const assistantLabel = assistantOpen ? 'Hide assistant' : 'Show assistant';
  const swapLabel = wrappersSwapped
    ? 'Restore workspace and assistant order'
    : 'Swap workspace and assistant';

  const handleAssistantToggle = () => {
    const assistantEl = document.getElementById('assistant-wrapper');
    const focusInside = Boolean(
      assistantOpen && assistantEl?.contains(document.activeElement),
    );
    toggleAssistantWrapper();
    if (focusInside) {
      requestAnimationFrame(() => {
        document.getElementById('header-btn-assistant')?.focus();
      });
    }
  };

  return (
    <div id="header-bar" className="header-bar">
      <TabBar />
      <div className="ai-toggle-col">
        <button
          id="header-btn-swap"
          type="button"
          title={canSwapWrappers ? swapLabel : 'Swap requires both workspace and assistant open'}
          aria-label={swapLabel}
          aria-pressed={wrappersSwapped}
          disabled={!canSwapWrappers}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => toggleWrappersSwapped()}
          className={`ai-toggle-btn${wrappersSwapped && canSwapWrappers ? ' ai-toggle-btn--on' : ''}`}
        >
          <ArrowLeftRight size={16} />
        </button>
        <button
          id="header-btn-assistant"
          type="button"
          title={assistantLabel}
          aria-label={assistantLabel}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={handleAssistantToggle}
          aria-pressed={assistantOpen}
          className={`ai-toggle-btn${assistantOpen ? ' ai-toggle-btn--on' : ''}`}
        >
          <PanelRight size={16} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verify (header + shortcut)**

Confirm:
1. `#header-btn-terminal` is gone from the header
2. Swap and assistant buttons still work
3. Ctrl/Cmd+J still toggles the terminal panel
4. `#nav-btn-terminal` remains the only UI toggle

Expected: no header terminal control; shortcut and nav button both work.

- [ ] **Step 3: Commit (only if user asks)**

```bash
git add src/components/header/Header.tsx src/components/layout/LeftNarrowSidebar.tsx src/index.css
git commit -m "move terminal toggle from header to left nav rail"
```

Skip this step unless the user explicitly requests a commit.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Remove `#header-btn-terminal` | Task 2 |
| Add `#nav-btn-terminal` at bottom of `#nav-bar` | Task 1 |
| Pin with `margin-top: auto` / separate from Settings | Task 1 |
| Same toggle store + labels + Ctrl+J title | Task 1 |
| `nav-btn` / `nav-btn--on` styling | Task 1 |
| Leave Ctrl+J / panel / swap / assistant alone | Task 2 (implicit non-touch) |

Placeholder scan: none. Type/name consistency: `nav-btn-terminal`, `terminalPanelOpen`, `setTerminalPanelOpen` used consistently.
