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

## Responsive layout

The history list adapts to the viewport, with a single breakpoint at **768px**:

- **Tablet and desktop (≥ 768px): plain table.** A bordered table with a sticky-feeling header row (**Date · Task · Details · ✎**) and a single divider between rows — no per-row card chrome. The *Details* column holds the combined meta string (hours · location · performed-by · comments · photo count), truncated with ellipsis; the full text remains available via the row's `title` on hover. Columns stay aligned across all rows.
- **Mobile (< 768px): cards.** Each entry stays a stacked card (task + actions on top, date below, details wrapping underneath). The table header is hidden. This is the current mobile layout, unchanged.

Both the global History screen and the per-equipment History tab use this same responsive behaviour.

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

### Tablet / desktop (≥ 768px) — table

```
+----------------------------------------------------------------+
|  History                                  [+ Log intervention]  |
+----------------------------------------------------------------+
|  Equipment: [ All ▾ ]   Date: [ — to — ]                       |
+----------------------------------------------------------------+
|  Date         Task          Details                            |
|----------------------------------------------------------------|
|  12 Apr 2026  Oil change     1245 h · Marina X       [Edit][×] |
|  25 Jan 2026  Filter check   1180 h                  [Edit][×] |
+----------------------------------------------------------------+
```

### Mobile (< 768px) — cards

```
+------------------------------------------+
|  History            [+ Log intervention] |
+------------------------------------------+
|  Oil change                   [Edit] [×] |
|  12 Apr 2026                             |
|  1245 h · Marina X                       |
|  ----------------------------------------|
|  Filter check                 [Edit] [×] |
|  25 Jan 2026                             |
|  1180 h                                  |
+------------------------------------------+
```
