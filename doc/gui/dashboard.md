# Dashboard

The Dashboard is the **landing screen** of the app. Its purpose is to answer: *"What do I need to take care of?"*

## Purpose

- Surface **overdue** and **upcoming** maintenance tasks across all equipments.
- Let the user quickly **log an intervention** for any due task.

## Content

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

## Layout sketch

```
+------------------------------------------------------+
|  Dashboard                                           |
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
