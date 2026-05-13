# Dashboard

The Dashboard is the **landing screen** of the app. Its purpose is to answer: *"What do I need to take care of?"*

## Purpose

- Surface **overdue** and **upcoming** maintenance tasks across all equipments.
- Let the user quickly **log an intervention** for any due task.
- Remind the user to **keep the hour-meters fresh** on hour-tracked equipments, so hour-based due dates remain accurate.

## Content

### Hour-meter freshness banner (top of screen)

Shown whenever **at least one equipment** has `tracks_hours = true`. The banner exists to nudge the user — without an up-to-date hour-meter, the app cannot reliably compute when hour-based tasks are due.

Banner content:
- Title: *"Keep your hour-meters fresh"* (or similar).
- For each hour-tracked equipment, a row showing:
  - Equipment name (clickable → equipment detail).
  - Current hours value.
  - Relative time since `hours_updated_at` (e.g. *"updated 3 days ago"*, *"updated 2 months ago"*, *"never updated"*).
  - A **"Update hours"** button → opens the hours update form (see [equipments.md](../gui/equipments.md)).
- Equipments whose `hours_updated_at` is older than the **staleness threshold** (default: 7 days, configurable in Settings) are visually emphasized (e.g. amber/red highlight, bold relative time).
- Rows are sorted by `hours_updated_at` ascending (oldest first).

The banner is collapsible. Equipments with fresh hour-meters can be folded away while stale ones remain expanded.

### Upcoming tasks

Upcoming tasks are **grouped by equipment**. Within each equipment block, tasks are sorted by urgency (most overdue first, then closest due date).

For each equipment block:
- Equipment name (clickable → equipment detail).
- Optional hour-meter value (if the equipment tracks hours).
- A list of its **overdue** and **due-soon** tasks. Tasks that are OK are not shown here.

For each task row:
- Task name.
- Urgency indicator: **color** (red = overdue, amber = due soon) + **relative time** ("overdue by 3 days", "in 12 days", "in 80 hours").
- Quick action: **"Mark done"** button → opens the quick log form (see [interventions.md](./interventions.md)).

## Filtering / scope

- The dashboard shows only tasks with status **overdue** or **due soon**.
- Equipments with no due tasks are hidden from the dashboard.

## Empty state

When there is no overdue/due-soon task:
- Friendly message: *"You're all caught up. Nothing due right now."*
- If the user has no equipments yet, redirect the message to the Equipments empty state with a CTA: *"Add your first equipment"*.

Note: the hour-meter freshness banner is independent of the tasks empty state. It can be visible even when no tasks are due.

## User flows

### Flow: Log an intervention from the dashboard
1. User sees an overdue/due task.
2. User taps **"Mark done"** on the task row.
3. Quick log form opens (date defaults to today; hours pre-filled if equipment tracks hours).
4. User confirms.
5. Task disappears from the dashboard (or moves down if other tasks of the same equipment remain).

### Flow: Jump to an equipment
1. User taps the equipment name in a block header.
2. Navigates to the equipment detail screen (Tasks tab).

### Flow: Update an hour-meter from the dashboard banner
1. User sees the freshness banner at the top of the dashboard, with a stale equipment highlighted.
2. User taps **"Update hours"** on the equipment row.
3. The hours update form opens (same form as the equipment detail screen).
4. User enters the new value and saves.
5. The equipment's `hours` and `hours_updated_at` are updated. Any hour-based task statuses are recomputed.
6. The banner row visually returns to a "fresh" state (or moves to the bottom of the banner).

## Layout sketch

```
+------------------------------------------------------+
|  Dashboard                                           |
+------------------------------------------------------+
|  ⏱  Keep your hour-meters fresh                      |
|    Main Engine    1245 h   updated 2 mo ago [Update] |  <- stale, emphasized
|    Tractor        842 h    updated 3 days ago [Upd.] |
+------------------------------------------------------+
|                                                      |
|  ● Main Engine                       (1245 h)        |
|    🔴 Oil change         overdue by 3 days  [Done]   |
|    🟡 Filter check       in 12 days         [Done]   |
|                                                      |
|  ● Family Car                                        |
|    🔴 Tire rotation      overdue by 1 month [Done]   |
|                                                      |
+------------------------------------------------------+
```
