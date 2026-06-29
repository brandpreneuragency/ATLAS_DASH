# UI Wireframes and Layout Rules

## Visual Reference

Use this screenshot as the primary visual reference:

```text
assets/crm-dashboard-4-views.png
```

The screenshot shows four target CRM states:

1. CRM Dashboard Overview
2. Leads Management / Lead Detail
3. Pipeline View
4. Companies / Activity View

## Global Shell

Every CRM/Form screen must follow:

```text
App Sidebar → Panel 1 → Panel 2 → Panel 3 CRM AI Sidebar
```

Do not create modal-heavy or full-screen isolated layouts for CRM/Form pages. The only exception is a temporary preview modal for form embed previews if the current layout requires it.

## App Sidebar

Add these items:

```text
CRM
Forms
```

Use the same icon style and selected-state treatment as existing sidebar items.

## Panel 1 Rules

Panel 1 changes by module:

### CRM Panel 1

- CRM nav
- search/list/filter area depending on page
- saved views
- quick add action at bottom where logical

### Forms Panel 1

- Forms nav
- form list or submission list depending on page
- filters
- recent forms

Panel 1 should feel like the task list panel: compact, readable, and list-driven.

## Panel 2 Rules

Panel 2 is the working surface.

Use:

- card grid for dashboards
- tabs for detail pages
- Kanban for pipeline
- split inner layout for form builder
- timeline for activity/company activity

Panel 2 should not become visually heavier than current task/doc mode.

## Panel 3 Rules

Panel 3 is always CRM/Form AI.

Title:

```text
CRM Agents
```

Agents:

```text
Lead Qualifier — Score and qualify new leads
Follow-up Writer — Draft personalized outreach
Pipeline Analyst — Analyze deals and forecast
Form Assistant — Map and improve forms
```

Panel 3 reusable states:

- Dashboard assistant
- Lead assistant
- Contact assistant
- Company assistant
- Pipeline assistant
- Form builder assistant
- Submission assistant

Keep layout connected to doc-mode AI sidebar classes so future styling can control both together.

## CRM Dashboard Wireframe

```text
Panel 1:
CRM nav
Saved views
Recent objects

Panel 2:
Topbar: CRM Dashboard + date/filter
KPI cards row
Recent Leads card
Follow-ups Due card
Pipeline Snapshot card
Recent Form Submissions table

Panel 3:
CRM Agents
Suggested for today
Quick prompts
Bottom AI input
```

## Leads Wireframe

```text
Panel 1:
Leads title
Saved views dropdown
Search
Filter button
Lead list
+ Add lead

Panel 2:
Lead header: name/company/status/stage/edit
Tabs: Overview Notes Activity Tasks Form Data Emails
Two-column detail cards
Bottom notes/comment input where consistent

Panel 3:
Lead summary
Recommended next step
Draft follow-up
Quick prompts
Bottom AI input
```

## Pipeline Wireframe

```text
Panel 1:
Pipeline filters
Saved views

Panel 2:
Metrics row
Kanban columns
Deal cards
Add deal controls

Panel 3:
Pipeline insights
Stuck deals
Opportunity cards
Win-rate card
Bottom AI input
```

## Company / Activity Wireframe

```text
Panel 1:
Companies search/list

Panel 2:
Company header
Tabs: Overview Contacts Leads Deals Activity Files
Timeline cards

Panel 3:
Company insights
Recommended action
Draft follow-up
Bottom AI input
```

## Forms Builder Wireframe

```text
Panel 1:
Forms nav/list

Panel 2:
Builder topbar
Tabs: Build Style Logic Embed Submissions Settings
Inner work area changes by tab

Panel 3:
Form Assistant context
Preview/apply AI actions
Bottom AI input
```

## Responsive Behavior

Desktop:

- show all 3 panels.

Tablet:

- allow Panel 1 or Panel 3 collapse using existing behavior if available.

Mobile:

- use stacked navigation/detail/AI flow.
- do not try to squeeze Kanban into six columns; use horizontal scroll or stage selector.

## Component Style Rules

- Reuse existing button/card/input/list/chip styles if present.
- Add CRM-specific components only when necessary.
- Keep class names readable and scoped.
- Avoid generic global names like `.card`, `.row`, `.panel` unless existing convention uses them.
- Prefer `crm-*`, `forms-*`, or shared layout class prefixes.
