# History

A **global, chronological view of all interventions** across every equipment. Reachable from the main navigation.

A per-equipment history also exists inside each equipment's detail screen (History tab). The two share the same row layout.

## Purpose

- Browse what has been done, when, and on what.
- Edit or correct a past intervention.
- Manually log an intervention (e.g. backdated entry) via **"+ Log intervention"**.

## Content

A reverse-chronological list of interventions. Each row shows:

- **Date** (primary).
- **Equipment name**.
- **Task name**.
- **Hours** at the time (if applicable).
- **Location** (if any).
- **Comments** (truncated; full text on tap/click).
- Actions: **Edit**, **Delete**.

## Filters

A simple filter bar above the list:
- **Equipment** (single select, default: all).
- **Date range** (from / to).

The per-equipment History tab has the equipment filter implicit (pinned).

## Empty state

- Global, no interventions: *"No interventions logged yet. Once you mark tasks as done, they'll appear here."* + CTA **"+ Log intervention"**.
- Per equipment, no interventions: *"No history yet for this equipment."* + CTA **"+ Log intervention"**.

## User flows

### Flow: Inspect or edit a past intervention
1. User opens History (global or per-equipment).
2. Scrolls/filters to find the entry.
3. Taps the row → details expand, or opens the full form for edit.
4. On save, side effects (equipment hours, next-due) are recomputed.

### Flow: Backdated intervention
1. User taps **"+ Log intervention"** in the History screen.
2. Full intervention form opens (see [interventions.md](./interventions.md)).
3. User picks equipment, task, sets an older date, fills the rest, saves.

## Layout sketch

```
+------------------------------------------------------+
|  History                            [+ Log intervention] |
+------------------------------------------------------+
|  Equipment: [ All ▾ ]   Date: [ — to — ]            |
+------------------------------------------------------+
|  12 Apr 2026  Main Engine  Oil change                |
|               1245 h • Marina X                      |
|                                          [Edit] [×] |
|  ---------------------------------------------------|
|  25 Jan 2026  Main Engine  Filter check              |
|               1180 h                                 |
|                                          [Edit] [×] |
+------------------------------------------------------+
```
