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
- **Trigger summary**: e.g. *"Every 100 h or 6 months"*, *"Every 12 months"*. An expiry task reads *"On expiry date"*.
- **Urgency indicator**: color + status label + timing text, same as the dashboard (see [dashboard.md](./dashboard.md#timing-text)). An OK task shows *"OK"* only. An **incomplete** task (see [data-model.md](../data-model.md#incomplete-equipment)) shows *"Incomplete — no expiry date"* or *"Incomplete — never done"*.
- **Last intervention**: date (or *"never"*).
- Quick actions:
  - **"Mark done"** → opens the quick log form (see [interventions.md](./interventions.md)).
  - **Edit** / **Delete** task.
  - On an incomplete task, a way to fill the missing value: **"Set expiry date"** (expiry task with no expiry date) → the task edit form, which asks for the current expiry date; **"Set commissioning date"** (months task never done, equipment without a commissioning date) → the equipment edit form. "Mark done" fills it too, by logging a replacement or a first intervention.

Tasks are in [urgency order](../data-model.md#ranking-tasks-by-urgency) by default: overdue first, then incomplete, then due soon, then OK, and within each the task furthest through its interval first.

A prominent **"+ Add task"** button on the tab.

## Task form (create / edit)

Fields:
- **Kind** (create only): **Interval** (default) or **Expiry date**, two radio buttons. The kind cannot be changed later, so the edit form does not show the choice; it shows the kind as text instead (*"Interval task"* / *"Expiry task"*). See [data-model.md](../data-model.md#task-kinds).
- **Name** (required)
- **Description** (optional)
- Interval tasks:
  - **Hours interval** (optional, integer ≥ 1) — only shown if the equipment tracks hours.
  - **Months interval** (optional, integer ≥ 1)
- Expiry tasks:
  - **Current expiry date** (optional, date): the expiry date of the part already fitted. Shown only while the task has no intervention (always on create). Left empty, the task is **incomplete** (*"Incomplete — no expiry date"*, not overdue) until it is filled or a part is logged. Logging a replacement clears it, so after every intervention is deleted the field is empty again and the task is incomplete until it is filled.

Validation rules:
- Interval task: at least one of `hours_interval` or `months_interval` must be provided.
- If the equipment does not track hours, the hours field is hidden and cannot be set.
- Expiry task: only the name is required.

## Empty state

When an equipment has no tasks yet:
- Message: *"No maintenance tasks yet for this equipment."*
- CTA: **"+ Add the first task"**.

## User flows

### Flow: Add a task
1. From the equipment's Tasks tab, user taps **"+ Add task"**.
2. Task form opens.
3. User picks the kind, fills name, optional description, and at least one interval (interval task) or, optionally, the current expiry date (expiry task).
4. On save, the task appears in the list with status computed from the equipment's commissioning date (no interventions yet); if the equipment has no commissioning date, a time-based task is shown as incomplete (*"Incomplete — never done"*), unless its hours rule is overdue. An expiry task's status comes from its current expiry date (*"Due soon — Expires in 12 days"*); without one it is shown as incomplete (*"Incomplete — no expiry date"*).

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
|  🔴 Overdue — 3d ago                                 |
|  Every 100h or 6mo  · Last: 12 Apr 2026              |
|                                                      |
|  Filter check                       [Done][Edit][Del]|
|  🟡 Due soon — in 12d                                |
|  Every 12 months    · Last: 25 Jan 2026              |
+------------------------------------------------------+
```

Mobile (< 640 px) — actions wrap below the task info:
```
+-----------------------------+
|  Oil change                 |
|  🔴 Overdue — 3d ago        |
|  Every 100h or 6mo          |
|  Last: 12 Apr 2026          |
|            [Done] [Edit][Del]|
+-----------------------------+
```
