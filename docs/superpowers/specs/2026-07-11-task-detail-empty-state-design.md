# Task Detail Empty State (Hide Subtasks Bar) — Design

**Date:** 2026-07-11  
**Status:** Approved, pending implementation plan

## Summary

When no task is selected in task mode, the center panel must show only the
existing empty state (“Select a task from the sidebar”) and must **not** render
the subtasks header bar (`.subtasks-bar-wrapper` / `SubtasksToggleBar`).

Today the bar still mounts with placeholder copy (“Untitled task”, “No due
date”, “No project”) even when `activeTask` is null. That is the bug.

## Behavior

| Condition | Subtasks bar | Center body |
|-----------|--------------|-------------|
| Task mode, list/calendar (not projects), **no** active task | Hidden | Existing empty state in `TaskDetailPanel` |
| Task mode, list/calendar, **active** task | Shown (unchanged) | Task detail (unchanged) |
| Task mode, projects page | Already hidden | Kanban (unchanged) |
| Non-task modes | Already hidden | Unchanged |

## Chosen approach

**Hide in `SubtasksToggleBar`:** after the existing `taskMode` / `projects`
early returns, if there is no resolved active task, return `null`.

`AppLayout` already gates the wrapper with:

```ts
const showSubtasksBar = ... && subtasksBar;
```

A falsy child from `SubtasksToggleBar` therefore removes `.subtasks-bar-wrapper`
with no layout changes.

Active task resolution stays as today:

```ts
const effectiveId = activeTaskId ?? storeActiveId;
const activeTask = tasks.find((t) => t.id === effectiveId) ?? null;
```

## Change surface

| File | Change |
|------|--------|
| `src/components/header/SubtasksToggleBar.tsx` | Early `return null` when `!activeTask` |

No changes to `AppLayout`, `App.tsx`, or `TaskDetailPanel`.

## Out of scope

- Richer empty-state UI (icon / title / subtitle matching CRM/Forms)
- Auto-selecting a task when the list loads
- Changing empty-state copy or styling in `TaskDetailPanel`

## Acceptance

1. With task mode open and no task selected: center panel shows only
   “Select a task from the sidebar”; no `.subtasks-bar-wrapper` in the DOM.
2. Selecting a task restores the subtasks bar and detail panel as before.
3. Deselecting / clearing the active task hides the bar again.
