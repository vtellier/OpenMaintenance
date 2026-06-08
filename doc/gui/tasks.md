# Tasks (Maintenance Program)

Tasks define **what** maintenance is required on an equipment and **when** it triggers. Tasks live inside an equipment.

## Where it lives

The Tasks tab inside an **equipment detail** screen. There is no global tasks view.

## Purpose

- Define the recurring maintenance items for the equipment (oil change, filter check, inspection, etc.).
- See the current due status of each task at a glance.

## Content

A list of tasks for this equipment, each row showing:

- **Name** of the task.
- **Trigger summary**: e.g. *"Every 100 h or 6 months"*, *"Every 12 months"*.
- **Urgency indicator**: color + relative time to next due (same convention as the dashboard).
- **Last intervention**: date (or *"never"*).
- Quick actions:
  - **"Mark done"** → opens the quick log form (see [interventions.md](./interventions.md)).
  - **Edit** / **Delete** task.

Tasks are sorted by urgency by default (overdue first, then due-soon, then OK).

A prominent **"+ Add task"** button on the tab.

## Task form (create / edit)

Fields:
- **Name** (required)
- **Description** (optional)
- **Hours interval** (optional, integer ≥ 1) — only shown if the equipment tracks hours.
- **Months interval** (optional, integer ≥ 1)

Validation rules:
- At least one of `hours_interval` or `months_interval` must be provided.
- If the equipment does not track hours, the hours field is hidden and cannot be set.

## Empty state

When an equipment has no tasks yet:
- Message: *"No maintenance tasks yet for this equipment."*
- CTA: **"+ Add the first task"**.

## User flows

### Flow: Add a task
1. From the equipment's Tasks tab, user taps **"+ Add task"**.
2. Task form opens.
3. User fills name, optional description, and at least one interval.
4. On save, the task appears in the list with status computed from the equipment's creation date (no interventions yet).

### Flow: Edit a task
1. User taps Edit on a task row.
2. Same form opens, prefilled.
3. On save, the task is updated; due status is recomputed.

### Flow: Delete a task
1. User taps Delete on a task row.
2. Confirmation modal: warns that all interventions recorded for this task will be deleted.
3. On confirm, task and its interventions are removed.

### Flow: Mark a task as done
See [interventions.md](./interventions.md).

## Photos (issue #26)

A task can have photos attached (e.g. diagrams, reference images, before/after shots). Photos are shown at the bottom of the task edit form and browsable from the task row.

- The task row shows a photo count badge when photos are present (e.g. *"2 photos"*).
- The task edit form shows a photo grid at the bottom with an **"+ Add photo"** button.
- Each photo can be deleted individually.
- Tapping a photo opens it full-screen.

See [file-storage.md](../file-storage.md) for the storage design.

## Layout sketch

Desktop and tablet (≥ 640 px):
```
+------------------------------------------------------+
|  ← Main Engine                                       |
|  [ Tasks ]  History  Documents  Info                 |
+------------------------------------------------------+
|                                          [+ Add task]|
|  Oil change                         [Done][Edit][Del]|
|  🔴 overdue by 3 days                                |
|  Every 100h or 6mo  · Last: 12 Apr 2026              |
|                                                      |
|  Filter check                       [Done][Edit][Del]|
|  🟡 due in 12 days                                   |
|  Every 12 months    · Last: 25 Jan 2026              |
+------------------------------------------------------+
```

Mobile (< 640 px) — actions wrap below the task info:
```
+-----------------------------+
|  Oil change                 |
|  🔴 overdue by 3 days       |
|  Every 100h or 6mo          |
|  Last: 12 Apr 2026          |
|            [Done] [Edit][Del]|
+-----------------------------+
```
