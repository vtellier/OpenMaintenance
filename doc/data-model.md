# Data Model

The domain has three core entities and one optional concept (hour-meter) tied to Equipment.

## Equipment

A component of the maintained system (e.g. "Main Engine", "Family Car", "House HVAC").

| Field             | Type      | Required | Notes                                                   |
|-------------------|-----------|----------|---------------------------------------------------------|
| `id`              | int       | yes      | Auto-generated                                          |
| `name`            | string    | yes      | e.g. "Main Engine"                                      |
| `description`     | string    | no       | Optional free text                                      |
| `tracks_hours`    | boolean   | yes      | Whether this equipment uses an hour-meter (default: false) |
| `hours`           | number    | no       | Current hour-meter value. Only relevant if `tracks_hours` is true. |
| `created_at`      | timestamp | yes      | Auto                                                    |
| `updated_at`      | timestamp | yes      | Auto                                                    |

### Hour-meter behavior

- The hour-meter is **manually updated by the user**. The app does not infer hours from time.
- It is only visible/editable when `tracks_hours` is true.
- It can be updated:
  - When logging an intervention (current hours captured at that moment).
  - Independently, from the equipment detail screen.
- If `tracks_hours` is false, hour-based task intervals are not allowed on this equipment's tasks.

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

A single recorded execution of a Task. Forms the history.

| Field         | Type      | Required | Notes                                                            |
|---------------|-----------|----------|------------------------------------------------------------------|
| `id`          | int       | yes      |                                                                  |
| `task_id`     | int       | yes      | FK to Task                                                       |
| `date`        | date      | yes      | When the work was performed                                      |
| `hours_at`    | number    | no       | Equipment hour-meter reading at the time. Only if equipment tracks hours. |
| `location`    | string    | no       | e.g. "Marina X", "Home garage"                                   |
| `comments`    | string    | no       | Free-form notes                                                  |
| `created_at`  | timestamp | yes      |                                                                  |
| `updated_at`  | timestamp | yes      |                                                                  |

### Side effects

- When an intervention is recorded with `hours_at`, the parent equipment's `hours` is updated to that value (if greater than current).
- The next due date for the task is recomputed from the latest intervention.

## Derived: "due" status

For each Task we compute a status used in the UI:

- **Overdue** — the time-based or hour-based interval has been exceeded since the last intervention (or since the equipment was created if there is no intervention yet).
- **Due soon** — within a configurable window before the next trigger (default: 30 days; for hour-based, an equivalent margin).
- **OK** — not due soon.

The "next due" date is computed from the most recent intervention on that task (or the equipment's creation date if no intervention exists yet).
