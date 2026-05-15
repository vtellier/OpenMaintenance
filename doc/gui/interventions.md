# Interventions (Logging a maintenance action)

An **intervention** is a record that a task was performed. Logging interventions is the most frequent user action, so it must be fast.

## Two entry modes

### 1. Quick log (default, one-tap path)

Triggered by the **"Mark done"** button available on:
- A task row in the **Dashboard**.
- A task row in an **equipment's Tasks tab**.

Opens a small modal/sheet with a minimal form:
- **Date** (defaults to today, editable).
- **Hours** (only if equipment tracks hours; pre-filled with current equipment hours, editable).
- **Done by** (optional, single-line text, placeholder "e.g. Self, Garage du Port").
- **Comments** (optional, single line).
- Two buttons: **Save** / **Cancel**.

Location is not asked in quick mode (kept for the full form).

### 2. Full intervention form

Accessible from:
- An equipment's History tab → **"+ Log intervention"**.
- The global History screen → **"+ Log intervention"**.

The user must first pick the equipment and the task (or these are pre-selected when coming from a task context). Then fields:

- **Equipment** (required, pre-selectable)
- **Task** (required, filtered by chosen equipment)
- **Date** (required, defaults to today)
- **Hours** (if equipment tracks hours, pre-filled with current value)
- **Location** (optional, free text)
- **Done by** (optional, free text, placeholder "e.g. Self, Garage du Port")
- **Comments** (optional, multi-line)
- **Save** / **Cancel**.

## Validation rules

- Date cannot be in the future. (Optional warning if older than 5 years.)
- If `hours` is provided, it must be ≥ the equipment's current `hours`. If the user enters a lower value, show an inline warning but allow it (the equipment hours will not be lowered).

## Side effects on save

- A new Intervention row is created.
- The equipment's `hours` is updated to the new value if greater than current.
- The parent task's next-due is recomputed.
- The dashboard refreshes (the task may disappear if no longer due).

## Editing / deleting an intervention

- Past interventions are editable and deletable from:
  - The equipment's **History** tab.
  - The global **History** screen.
- Editing opens the full form prefilled.
- Deleting requires a confirmation. Side effects (next-due, equipment hours) are recomputed from the remaining history.

## User flow: quick log from dashboard

1. User is on the Dashboard, sees an overdue task.
2. Taps **"Mark done"**.
3. Quick log sheet slides up. Date = today. Hours pre-filled if applicable.
4. User taps **Save**.
5. Sheet closes. Task disappears from the dashboard (or is reordered).

## Layout sketch (quick log)

```
+-----------------------------+
|  Mark done: Oil change      |
+-----------------------------+
|  Date    [ 2026-05-13   ▾ ] |
|  Hours   [ 1245           ] |   (only if applicable)
|  Done by [                ] |
|  Notes   [                ] |
|                             |
|        [ Cancel ]  [ Save ] |
+-----------------------------+
```
