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
  - A **"Same hours"** button → confirms, in place, that the hour-meter has not changed since the last reading. It refreshes `hours_updated_at` to "now" without changing the value, so the row drops out of the stale list. Used when the equipment simply has not run.
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
- Urgency indicator: **color** (red = overdue, amber = due soon) + status label + **timing text** (see below), e.g. *"Overdue — 3d ago"*, *"Due soon — in 12d"*, *"Due soon — in 80 h"*.
- Quick action: **"Mark done"** button → opens the quick log form (see [interventions.md](./interventions.md)).

#### Timing text

The relative time after the status label. It is rendered from the task's driving trigger and amount (`due_trigger`, `due_in_days`, `due_in_hours`, see [data-model.md](../data-model.md#driving-trigger-and-amount)), never guessed by the page from the next due date. The Dashboard, the Equipments list card and the Equipment detail Tasks tab all use the same text.

| Driving trigger | Amount                          | Text          |
|-----------------|---------------------------------|---------------|
| months          | `due_in_days` < 0               | *"3d ago"*    |
| months          | `due_in_days` = 0               | *"today"*     |
| months          | `due_in_days` > 0               | *"in 12d"*    |
| hours           | `due_in_hours` rounds below 0   | *"120 h ago"* |
| hours           | `due_in_hours` rounds to 0      | *"now"*       |
| hours           | `due_in_hours` rounds above 0   | *"in 8 h"*    |

Hours are rounded to the nearest whole hour and use the same number format as the hour-meter value (*"1,500 h ago"*). A task overdue by hours shows the hours, even when its calendar due date is still ahead.

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

### Flow: Dismiss the reminder when hours have not changed
1. User sees a stale equipment in the freshness banner but the equipment has not run since the last reading.
2. User taps **"Same hours"** on the equipment row.
3. The app refreshes `hours_updated_at` to "now", keeping the same `hours` value (no form, no navigation).
4. The row immediately returns to a "fresh" state and folds into the "fresh" group.

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
|    🔴 Oil change         Overdue — 3d ago   [Done]   |
|    🟡 Filter check       Due soon — in 12d  [Done]   |
|                                                      |
|  ● Family Car                                        |
|    🔴 Tire rotation      Overdue — 34d ago  [Done]   |
|                                                      |
+------------------------------------------------------+
```
