# Interventions (Logging a maintenance action)

An **intervention** is a record that a task was performed. Logging interventions is the most frequent user action, so it must be fast.

## The intervention form

One form logs and edits every intervention. It opens from:
- **"Done"** on a task row in the **Dashboard** or in an **equipment's Tasks tab**: the form opens prefilled to mark that task done (see below).
- An equipment's History tab → **"+ Log intervention"**.
- The global History screen → **"+ Log intervention"**.

There is no separate quick log: **Done** opens this same form.

### Opened from Done (marking a task done)

The form is prefilled, so saving still takes one tap:
- **Equipment**: the row's equipment, selected (on Equipment detail the equipment picker is hidden, as for any log there).
- **Task**: the row's task, selected.
- **Date**: today in the user's timezone.
- **Hours** (if the equipment tracks hours): the equipment's current reading, or empty when it has no reading yet. The app never invents one.
- **Expiry date** (expiry task only): empty, and required, so Save stays disabled until it is entered.
- Every other field starts as for a new log: unchecked exceptional switch, empty Location, Done by and Comments.

Saving logs the intervention, closes the form and refreshes the page's list: the task leaves the Dashboard's due list (or is reordered), and the Tasks tab shows its new status and last date. A save the backend refuses keeps the form open and shows the backend's reason (e.g. *"intervention date cannot be in the future"*).

### Fields

The user picks the equipment and the task, unless they are pre-selected (opened from Done, or from an equipment's page). Then fields:

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
- Deleting requires a confirmation: *"Are you sure you want to delete this intervention? Task due dates will be recomputed from the remaining history. The equipment's hour-meter reading is not lowered."* Next-due dates are recomputed from the remaining history; the equipment's reading is kept.

### Reading in doubt (after a delete or an edit)

When the deleted intervention, or the edited one whose reading was lowered, cleared or moved to another equipment, recorded the equipment's current reading, the reading may have come from it (see [data-model.md](../data-model.md#reading-in-doubt)). Once the delete or the edit is saved, a modal asks:

- Title: *"Keep the hour-meter reading?"*
- Text: *"This intervention recorded 500 h, the current reading of Main Engine. The reading may have come from it."*
- **Keep the reading** (primary, focused: the default). Closes the modal; nothing changes, freshness included. Closing the modal any other way (overlay click) also keeps it.
- **Correct the reading**: opens [Correct reading](./equipments.md#flow-correct-the-reading) for that equipment, prefilled with the highest reading left on its interventions, or empty if there is none.

When the current reading is higher than the intervention's, nothing is asked: the reading is kept.

Nothing is asked either when another intervention left on the equipment still recorded the current reading (the reading is still backed by the history), or when the equipment's reading, reloaded once the change is saved, no longer equals the one in doubt (it changed meanwhile, e.g. in another tab).

## User flow: mark a task done from the dashboard

1. User is on the Dashboard, sees an overdue task.
2. Taps **"Done"**.
3. The intervention form opens with the task's equipment and the task selected, date = today, hours = the equipment's current reading (empty when it has none yet).
4. User taps **Save** (an expiry task first needs its expiry date).
5. The form closes. Task disappears from the dashboard (or is reordered).

## Photos (issue #25)

An intervention can have photos attached (e.g. the state of a part before/after the work). Photos are attached in the intervention form once the intervention is saved: a new log (from Done or "+ Log intervention") shows a hint to save first; editing a past intervention from the History tab shows its photos.

- The history list shows a photo count badge when photos are present (e.g. *"3 photos"*).
- The intervention detail/edit view shows a photo grid at the bottom with an **"+ Add photo"** button.
- Each photo can be deleted individually.
- Tapping a photo opens it full-screen.

See [file-storage.md](../file-storage.md) for the storage design.

## Layout sketch (opened from Done)

```
+-----------------------------------+
|  Log intervention                 |
+-----------------------------------+
|  Equipment [ Main Engine      ▾ ] |   (hidden on Equipment detail)
|  [ ] Exceptional intervention ⓘ   |
|  Task      [ Oil change       ▾ ] |
|  Date      [ 2026-05-13       ▾ ] |
|  Hours     [ 1245               ] |   (only if applicable)
|  Location  [                    ] |
|  Done by   [                    ] |
|  Comments  [                    ] |
|  Save the intervention to attach  |
|  photos.                          |
|                                   |
|            [ Cancel ]  [ Save ]   |
+-----------------------------------+
```
