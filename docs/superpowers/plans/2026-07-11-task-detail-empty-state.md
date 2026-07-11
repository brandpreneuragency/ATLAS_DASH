# Task Detail Empty State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide `SubtasksToggleBar` when no task is selected so the center panel shows only the existing empty state.

**Architecture:** One early return in `SubtasksToggleBar` when `activeTask` is null. `AppLayout` already omits `.subtasks-bar-wrapper` when the bar child is falsy.

**Tech Stack:** React, existing Zustand task/UI stores

## Global Constraints

- Keep existing empty-state copy in `TaskDetailPanel` (“Select a task from the sidebar”)
- No richer empty-state UI
- No changes to `AppLayout`, `App.tsx`, or `TaskDetailPanel`

---

## File map

| File | Role |
|------|------|
| `src/components/header/SubtasksToggleBar.tsx` | Add `if (!activeTask) return null` after existing early returns |

---

### Task 1: Hide bar when no active task

**Files:**
- Modify: `src/components/header/SubtasksToggleBar.tsx`

- [x] **Step 1: Add early return**

After the `activeTaskPage === 'projects'` check, add:

```tsx
if (!activeTask) return null;
```

- [ ] **Step 2: Manual verify**

1. Open task mode with no task selected → no `.subtasks-bar-wrapper`; body shows “Select a task from the sidebar”
2. Select a task → bar and detail restore
3. Clear selection → bar hides again

- [ ] **Step 3: Commit** (only if user requests)

```
fix(ui): hide subtasks bar when no task selected
```
