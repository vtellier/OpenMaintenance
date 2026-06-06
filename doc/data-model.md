# Data Model

The domain has three core entities and one optional concept (hour-meter) tied to Equipment.

## Equipment

A component of the maintained system (e.g. "Main Engine", "Family Car", "House HVAC").

| Field             | Type      | Required | Notes                                                   |
|-------------------|-----------|----------|---------------------------------------------------------|
| `id`              | int       | yes      | Auto-generated                                          |
| `name`            | string    | yes      | e.g. "Main Engine"                                      |
| `description`     | string    | no       | Optional free text                                      |
| `commissioned_at` | date      | no       | Date the equipment was put into service. Used for informational purposes only. |
| `tracks_hours`    | boolean   | yes      | Whether this equipment uses an hour-meter (default: false) |
| `hours`           | number    | no       | Current hour-meter value. Only relevant if `tracks_hours` is true. |
| `hours_updated_at`| timestamp | no       | Timestamp of the last hour-meter update. Only relevant if `tracks_hours` is true. |
| `picture`         | string    | no       | Relative path to the profile picture file (e.g. `files/equipments/12/picture.jpg`). NULL when no picture is set. See [file-storage.md](./file-storage.md). |
| `icon`            | string    | no       | A single emoji used as the equipment's icon when no `picture` is set. Defaults to `🔧`. |
| `created_at`      | timestamp | yes      | Auto                                                    |
| `updated_at`      | timestamp | yes      | Auto                                                    |

### Visual identity (picture vs icon)

Every equipment has a visual marker shown on the detail header, the list cards, and the dashboard. The precedence is:

1. If `picture` is set, show the uploaded picture.
2. Otherwise show the `icon` emoji.
3. `icon` itself defaults to `🔧`, so an equipment always has a marker even before the user customizes anything.

The `icon` is edited as plain equipment metadata (via the equipment create/edit form). The `picture` is managed through dedicated upload/serve/delete endpoints — see [file-storage.md](./file-storage.md).

### Hour-meter behavior

- The hour-meter is **manually updated by the user**. The app does not infer hours from time.
- It is only visible/editable when `tracks_hours` is true.
- It can be updated:
  - When logging an intervention (current hours captured at that moment).
  - Independently, from the equipment detail screen.
- If `tracks_hours` is false, hour-based task intervals are not allowed on this equipment's tasks.

#### `hours_updated_at` (freshness tracking)

- Set to "now" whenever the user **explicitly confirms** the hour-meter reading through a dedicated hour-meter update action — **even when the value is unchanged**. This lets the user dismiss the Dashboard freshness reminder for an equipment that simply has not run since the last reading.
  - The explicit actions are the **"Update hours"** form and the Dashboard **"Same hours"** shortcut (see [gui/dashboard.md](./gui/dashboard.md)).
  - The submitted value must be **greater than or equal to** the current `hours`; a lower value is rejected (the meter cannot go backwards).
  - Served by a dedicated endpoint (`PUT /equipments/{id}/hours`) so that editing other equipment metadata never affects freshness.
- For **intervention logging**, the timestamp is updated only when the supplied `hours_at` is **strictly greater than** the current `hours`. Logging an intervention with the same or a lower reading does not reset freshness.
- Used by the Dashboard to surface a CTA encouraging the user to keep the hour-meter fresh — without a fresh hour-meter, hour-based due dates cannot be trusted.
- A **"staleness threshold"** (default: 7 days) is used to flag the oldest updates. Configurable in Settings (future). The Dashboard CTA always lists every hour-tracked equipment, but visually emphasizes those older than the threshold.

## Task

A maintenance checkpoint tied to one Equipment. Defines the maintenance program.

| Field           | Type    | Required | Notes                                                               |
|-----------------|---------|----------|---------------------------------------------------------------------|
| `id`            | int     | yes      |                                                                     |
| `equipment_id`  | int     | yes      | FK to Equipment                                                     |
| `name`          | string  | yes      | e.g. "Oil change"                                                   |
| `description`   | string  | no       | Optional details                                                    |
| `hours_interval`  | int   | no       | Trigger every N hours of usage. Only allowed if equipment tracks hours. |
| `months_interval` | int   | no       | Trigger every N months                                              |

### Rules

- A Task **must** define at least one of: `hours_interval` or `months_interval`.
- If both are defined, the task is due whenever **either** condition is met first.
- `hours_interval` requires the parent equipment to have `tracks_hours = true`.

## Intervention

A recorded maintenance action on an Equipment. Forms the history.

There are two kinds of interventions:

- **Standard**: bound to a Task (the normal case — recurring maintenance).
- **Exceptional**: not bound to a task; used for one-off operations that must still be logged (e.g. replacing a broken part, unexpected repair).

Exactly one of `task_id` or `exceptional_label` must be provided (they are mutually exclusive).

| Field               | Type      | Required | Notes                                                            |
|---------------------|-----------|----------|------------------------------------------------------------------|
| `id`                | int       | yes      |                                                                  |
| `task_id`           | int       | no       | FK to Task. Present for standard interventions, absent for exceptional ones. |
| `equipment_id`      | int       | yes      | FK to Equipment. Populated automatically from the task for standard interventions; set directly for exceptional ones. |
| `exceptional_label` | string    | no       | Short description of the exceptional operation. Required when `task_id` is absent. |
| `date`              | date      | yes      | When the work was performed                                      |
| `hours_at`          | number    | no       | Equipment hour-meter reading at the time. Only if equipment tracks hours. |
| `location`          | string    | no       | e.g. "Marina X", "Home garage"                                   |
| `performed_by`      | string    | no       | Person or company who did the work (e.g. "Self", "Garage du Port") |
| `comments`          | string    | no       | Free-form notes                                                  |
| `created_at`        | timestamp | yes      |                                                                  |
| `updated_at`        | timestamp | yes      |                                                                  |

### Side effects

- When an intervention is recorded with `hours_at` and that value is greater than the equipment's current `hours`:
  - The equipment's `hours` is updated to that value.
  - The equipment's `hours_updated_at` is set to "now".
- For **standard** interventions: the next due date for the task is recomputed from the latest intervention.
- For **exceptional** interventions: no task due-date side effect.

## Derived: "due" status

For each Task we compute a status used in the UI:

- **Overdue** — the time-based or hour-based interval has been exceeded since the last intervention (or since the equipment was created if there is no intervention yet).
- **Due soon** — within a configurable window before the next trigger (default: 30 days; for hour-based, an equivalent margin).
- **OK** — not due soon.

The "next due" date is computed from the most recent intervention on that task (or the equipment's creation date if no intervention exists yet).

## File attachment tables

See [file-storage.md](./file-storage.md) for the full storage design.

### `equipment_files`

Documents (manuals, invoices, warranties) attached to an equipment.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `equipment_id` | int | yes | FK → equipment.id |
| `file_path` | string | yes | PK. Relative path to the file (e.g. `files/equipments/12/files/abc123.pdf`) |
| `uploaded_at` | timestamp | yes | |

### `task_files`

Photos attached to a task.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `task_id` | int | yes | FK → tasks.id |
| `file_path` | string | yes | PK. Relative path to the file (e.g. `files/equipments/12/tasks/7/abc123.jpg`) |
| `uploaded_at` | timestamp | yes | |

### `intervention_files`

Photos attached to an intervention.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `intervention_id` | int | yes | FK → interventions.id |
| `file_path` | string | yes | PK. Relative path to the file (e.g. `files/equipments/12/interventions/42/abc123.jpg`) |
| `uploaded_at` | timestamp | yes | |
