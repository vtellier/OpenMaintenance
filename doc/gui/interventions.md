# Interventions (Logging a maintenance action)

An **intervention** is a record that a task was performed. Logging interventions is the most frequent user action, so it must be fast.

## Two entry modes

### 1. Quick log (default, one-tap path)

Triggered by the **"Mark done"** button available on:
- A task row in the **Dashboard**.
- A task row in an **equipment's Tasks tab**.

Opens a small modal/sheet with a minimal form:
- **Date** (defaults to today in the user's timezone, editable).
- **Hours** (only if equipment tracks hours; pre-filled with current equipment hours, editable; empty when the equipment has no reading yet — the app never invents one). Same reading rule as the full form: the value entered is sent, `0` included; an empty field sends no reading.
- **Expiry date** (only for an [expiry task](../data-model.md#task-kinds); required, empty by default): the date printed on the part fitted. Same rule as the full form.
- **Done by** (optional, single-line text, placeholder "e.g. Self, Garage du Port").
- **Comments** (optional, single line).
- Two buttons: **Save** / **Cancel**.

The Dashboard and Equipment detail quick logs are the same form. A save the backend refuses keeps the modal open and shows the backend's reason (e.g. *"intervention date cannot be in the future"*), as the full form does.

Location is not asked in quick mode (kept for the full form).

### 2. Full intervention form

Accessible from:
- An equipment's History tab → **"+ Log intervention"**.
- The global History screen → **"+ Log intervention"**.

The user must first pick the equipment and the task (or these are pre-selected when coming from a task context). Then fields:

- **Equipment** (required, pre-selectable)
- **Exceptional intervention** checkbox (unchecked by default) with an `ⓘ` icon next to it. Hovering the icon shows a tooltip: _"Exceptional interventions are one-off operations not part of your maintenance plan (e.g. replacing a broken part). They appear in the history but do not affect task due dates."_
- **Task** (required when checkbox is unchecked; greyed out and disabled when checkbox is checked)
- **Exceptional intervention label** (text field, visible and mandatory only when the checkbox is checked; placeholder: "e.g. Replaced broken impeller")
- **Date** (required, defaults to today in the user's timezone)
- **Hours** (if equipment tracks hours, pre-filled with current value; empty when the equipment has no reading yet, so saving it untouched sends no reading). Whenever the selected equipment tracks hours, the value entered is sent as the intervention's reading, `0` included; an empty field, or an equipment that does not track hours, sends no reading. Editing an intervention logged without a reading shows the field empty.
- **Expiry date** (shown and required only when the selected task is an [expiry task](../data-model.md#task-kinds)): the date printed on the part fitted; when several identical parts are replaced together, the earliest one. Any date is accepted, past included (an expired part sometimes has to be fitted). Empty on a new log; editing prefills the intervention's. Sent only for an expiry task.
- **Location** (optional, free text)
- **Done by** (optional, free text, placeholder "e.g. Self, Garage du Port")
- **Comments** (optional, multi-line)
- **Save** / **Cancel**.

Save is disabled until all required fields are filled: date is always required; task is required unless the checkbox is checked; when the checkbox is checked, the exceptional label is required instead; an expiry task also requires its expiry date.

## Validation rules

- Date cannot be in the future (after today in the user's timezone). (Optional warning if older than 5 years.)
- If `hours` is provided, it must be ≥ the equipment's current `hours`. If the user enters a lower value, show an inline warning but allow it (the equipment hours will not be lowered).

## Side effects on save

- A new Intervention row is created.
- The equipment's `hours` is updated to the new value if greater than current, and its `hours_updated_at` is set to "now". An equal or lower value leaves both unchanged.
- For **standard** interventions: the parent task's next-due is recomputed; the dashboard refreshes (the task may disappear if no longer due). On an expiry task, the next due date becomes the expiry date entered.
- For **exceptional** interventions: no task due-date side effect; the dashboard is not affected.

## Editing / deleting an intervention

- Past interventions are editable and deletable from:
  - The equipment's **History** tab.
  - The global **History** screen.
- Editing opens the full form prefilled, from every entry point, with the intervention's equipment: the task's equipment for a standard intervention, the intervention's own for an exceptional one. Saving an edit applies the same hour-meter rule as logging: a higher hours value raises the equipment's reading, an equal or lower one leaves it unchanged.
- Deleting requires a confirmation. Side effects (next-due, equipment hours) are recomputed from the remaining history.

## User flow: quick log from dashboard

1. User is on the Dashboard, sees an overdue task.
2. Taps **"Mark done"**.
3. Quick log sheet slides up. Date = today. Hours pre-filled if applicable (empty when the equipment has no reading yet).
4. User taps **Save**.
5. Sheet closes. Task disappears from the dashboard (or is reordered).

## Photos (issue #25)

An intervention can have photos attached (e.g. the state of a part before/after the work). Photos are not available in the quick log — only in the full intervention form and when viewing a past intervention from the History tab.

- The history list shows a photo count badge when photos are present (e.g. *"3 photos"*).
- The intervention detail/edit view shows a photo grid at the bottom with an **"+ Add photo"** button.
- Each photo can be deleted individually.
- Tapping a photo opens it full-screen.

See [file-storage.md](../file-storage.md) for the storage design.

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
