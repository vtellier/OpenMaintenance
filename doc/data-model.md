# Data Model

The domain has three core entities and one optional concept (hour-meter) tied to Equipment.

## Equipment

A component of the maintained system (e.g. "Main Engine", "Family Car", "House HVAC").

| Field             | Type      | Required | Notes                                                   |
|-------------------|-----------|----------|---------------------------------------------------------|
| `id`              | int       | yes      | Auto-generated                                          |
| `name`            | string    | yes      | e.g. "Main Engine"                                      |
| `description`     | string    | no       | Optional free text                                      |
| `commissioned_at` | date      | no       | Date the equipment was put into service (`YYYY-MM-DD`). Used as the date baseline for tasks that have never been performed — see [Derived: "due" status](#derived-due-status). |
| `tracks_hours`    | boolean   | yes      | Whether this equipment uses an hour-meter (default: false) |
| `hours`           | number    | no       | Current hour-meter value. Only relevant if `tracks_hours` is true. |
| `hours_updated_at`| timestamp | no       | Timestamp of the last hour-meter update. Only relevant if `tracks_hours` is true. |
| `icon`            | string    | yes      | A single emoji used as the equipment's marker. Defaults to `🔧`; always has a value. |
| `created_at`      | timestamp | yes      | Auto                                                    |
| `updated_at`      | timestamp | yes      | Auto                                                    |

### Visual identity (icon)

Every equipment has a mandatory **`icon`** — a single emoji (default `🔧`) used as its marker wherever the equipment is referenced: the equipments list, the dashboard, and the equipment's own detail header (left of the name). It always has a value.

The `icon` is chosen from an emoji picker — a button (or, on the detail header, the icon itself) opens a searchable, categorized picker of all emojis (no text field), with a Reset to restore the 🔧 default. The picker's emoji data is bundled locally so it works offline. It can be set from the create/edit form, and changed directly by clicking the icon on the detail header (persisted immediately).

### Hour-meter behavior

- The hour-meter is **manually updated by the user**. The app does not infer hours from time.
- It is only visible/editable when `tracks_hours` is true.
- It can be updated:
  - When logging an intervention (current hours captured at that moment).
  - Independently, from the equipment detail screen.
- If `tracks_hours` is false, hour-based task intervals are not allowed on this equipment's tasks.

#### What changes the reading

The reading (`hours`) and its freshness (`hours_updated_at`) change only through the paths below. **None of them lowers the reading**: the meter cannot go backwards.

| Path | Reading (`hours`) | Freshness (`hours_updated_at`) |
|------|-------------------|--------------------------------|
| Create an equipment with `tracks_hours` on | Set to the initial value entered (none entered: no reading yet) | "now" when a value is entered |
| Turn `tracks_hours` on for an existing equipment | Set to the initial value entered. It must be **greater than or equal to** any reading kept from an earlier tracking period; a lower value is rejected | "now" when a value is entered |
| Turn `tracks_hours` off | Unchanged: kept, hidden while tracking is off | Unchanged |
| Edit metadata (name, description, commissioning date, icon, including the detail-header icon picker) | Unchanged: an hours value sent with the edit is ignored | Unchanged |
| **"Update hours"** or **"Same hours"** | Set to the value submitted, which must be **greater than or equal to** the current one; a lower value is rejected | "now", even when the value is unchanged |
| Log or edit an intervention with `hours_at` | Raised to `hours_at` only when it is **strictly greater** than the current reading | "now" only when the reading is raised |

- An intervention's `hours_at` on an equipment that does not track hours leaves the hour-meter untouched.
- Deleting an intervention does not change the reading today; whether it should be recomputed from the remaining history is not decided yet (issue #70).

#### `hours_updated_at` (freshness tracking)

- Set to "now" whenever the user **explicitly confirms** the hour-meter reading through a dedicated hour-meter update action — **even when the value is unchanged**. This lets the user dismiss the Dashboard freshness reminder for an equipment that simply has not run since the last reading.
  - The explicit actions are the **"Update hours"** form and the Dashboard **"Same hours"** shortcut (see [gui/dashboard.md](./gui/dashboard.md)).
  - The submitted value must be **greater than or equal to** the current `hours`; a lower value is rejected (the meter cannot go backwards).
  - Served by a dedicated endpoint (`PUT /equipments/{id}/hours`) so that editing other equipment metadata never affects freshness.
- For **intervention logging** (and editing), the timestamp is updated only when the supplied `hours_at` is **strictly greater than** the current `hours`. Logging an intervention with the same or a lower reading does not reset freshness.
- Entering the initial reading (at creation, or when turning `tracks_hours` on) also sets it to "now".
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
| `kind`          | enum    | yes      | `interval` (default) or `expiry`. Chosen at creation, never changed. See [Task kinds](#task-kinds). |
| `hours_interval`  | int   | no       | Trigger every N hours of usage. Only allowed if equipment tracks hours. Interval tasks only. |
| `months_interval` | int   | no       | Trigger every N months. Interval tasks only.                        |
| `current_expiry_date` | date | no  | Expiry tasks only: the expiry date of the part already fitted when the task is created (`YYYY-MM-DD`). Used only while the task has no intervention; cleared once a replacement is logged. |

### Task kinds

A task is one of two kinds (see `CONTEXT.md`):

- An **interval task** is due again after a number of months and/or hours counted from when it was last done.
- An **expiry task** stands for a part that carries a printed **expiry date** (e.g. a life jacket's CO2 cartridge). It is due when that date is reached. There is no separate Part entity.

The kind is chosen when the task is created and **cannot be changed** afterwards: an update that sends another kind is rejected; one that sends none keeps the task's kind. See [ADR 0001](./adr/0001-expiry-task-kind.md).

### Rules

- An interval task **must** define at least one of: `hours_interval` or `months_interval`.
- If both are defined, the task is due whenever **either** condition is met first.
- `hours_interval` requires the parent equipment to have `tracks_hours = true`.
- An interval task has no `current_expiry_date`.
- An expiry task has **no** `hours_interval` and **no** `months_interval`. Its `current_expiry_date` is optional. The task form shows it only while the task has no intervention; once one exists the date comes from the interventions.
- Saving an intervention with an `expiry_date` on an expiry task (a new one, or an edit that moves it onto that task) **clears** the task's `current_expiry_date`: that date belonged to a part that has since been replaced. Deleting every intervention later leaves the task with no expiry date, so the task form asks for it again.

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
| `hours_at`          | number    | no       | Equipment hour-meter reading at the time. Only if equipment tracks hours. Recorded on expiry tasks too, the same way. |
| `expiry_date`       | date      | no       | The expiry date of the part fitted (`YYYY-MM-DD`). **Required** for a standard intervention on an expiry task, and only allowed there. Any date is accepted, past included: an expired part sometimes has to be fitted. When several identical parts are replaced together, the earliest date is entered. |
| `location`          | string    | no       | e.g. "Marina X", "Home garage"                                   |
| `performed_by`      | string    | no       | Person or company who did the work (e.g. "Self", "Garage du Port") |
| `comments`          | string    | no       | Free-form notes                                                  |
| `created_at`        | timestamp | yes      |                                                                  |
| `updated_at`        | timestamp | yes      |                                                                  |

### Side effects

- When an intervention is recorded (or edited) with `hours_at`, the equipment tracks hours, and that value is greater than the equipment's current `hours`:
  - The equipment's `hours` is updated to that value.
  - The equipment's `hours_updated_at` is set to "now".
- For **standard** interventions: the next due date for the task is recomputed from the latest intervention. On an expiry task, it is the latest intervention's `expiry_date`: editing or deleting that intervention updates it.
- For **exceptional** interventions: no task due-date side effect.

## Derived: "due" status

For each Task we compute a status used in the UI:

- **Overdue** — the time-based or hour-based interval has been exceeded since the baseline (see below), or, for an expiry task, the expiry date has passed.
- **Due soon** — within a configurable window before the next trigger (default: 30 days; for hour-based, an equivalent margin). An expiry task is due soon from 30 days before its expiry date.
- **OK** — not due soon.

If a task defines both intervals, the **worst** of the two statuses wins. An expiry task has a single rule, the [expiry rule](#expiry-rule).

### Driving trigger and amount

Alongside the status, the API says **which trigger drives it** and **by how much**, so no client has to guess the trigger by comparing the next due date with today.

| Field          | Type                 | Meaning |
|----------------|----------------------|---------|
| `due_trigger`  | `months` \| `hours` \| `expiry` | The rule that drives `due_status`. Always `expiry` for an expiry task. Absent when no rule applies. |
| `due_in_days`  | integer              | Whole calendar days from today to `next_due_date`. Positive while the date is ahead (`12` = in 12 days), `0` on the due date itself, negative once it is past (`-3` = due 3 days ago). Present whenever the months rule applies **and has a date baseline**, and for an expiry task that has an expiry date. Absent (null) when there is no baseline, see below. |
| `due_in_hours` | number               | `next_due_hours` minus the equipment's current hour-meter reading. Positive while the reading is below it (`8` = in 8 h), negative once it is reached or passed (`-120` = due 120 h ago). Not rounded. Present whenever the hours rule applies. |

A rule **applies** when it can give a status:

- the **months** rule, when the task has a `months_interval`. Without a [date baseline](#date-baseline-precedence) it is **overdue with no amount**: no `next_due_date` and no `due_in_days`, since there is nothing to count from;
- the **hours** rule, when the task has an `hours_interval`, the equipment tracks hours, the equipment has a current reading (`hours`), and the task has an [hours baseline](#hours-baseline). Without a current reading, `next_due_hours` is still returned, but there is nothing to compare it with: no status and no `due_in_hours`. Without an hours baseline (performed, but never with a reading), there is no `next_due_hours` either.

Which trigger drives:

1. Only one rule applies: that one.
2. Both apply: the one with the **worse** status, the one that sets `due_status`.
3. Both give the same status (both overdue, both due soon, or both OK): the one with the **greater fraction of its interval elapsed** (see [Urgency](#urgency)), so the timing text shows the amount that makes the task urgent. Equal fractions: **months**, whose amount is always current, while the hours amount is only as fresh as the last hour-meter reading.

One exception to rule 3: a months rule with no date baseline has no amount to show and no fraction (see [Urgency](#urgency)), so when the hours rule is **overdue** too, **hours** drives, since it has a concrete amount (`due_in_hours`). If the hours rule is only due soon or OK, the months rule is the worse status and still drives, with no `due_in_days`.

`due_trigger` is also set when the task is OK. Both amounts are returned when both rules apply; the timing text shown to the user uses the driving one (see [gui/dashboard.md](./gui/dashboard.md#timing-text)).

The sign of the driving amount always agrees with the status: an **overdue** task has a driving amount `≤ 0`, a **due soon** or **OK** task has one `≥ 0`. The only tasks without a driving amount are the months-driven overdue task with no date baseline and the expiry task with no expiry date.

**Calendar days, not 24-hour periods.** `due_in_days` subtracts two calendar dates: the `next_due_date` and today's date, both read in the timezone `next_due_date` is computed in (currently UTC). A task due on the 15th is "in 5 days" all day on the 10th, and `0` all day on the 15th, whether or not it has already turned overdue that day.

### Expiry rule

An expiry task's `next_due_date` is its **current expiry date**, resolved in this order:

1. **The latest intervention's `expiry_date`** (latest by date, then the later logged): the part fitted then.
2. **The task's `current_expiry_date`**, while the task has no intervention. It is cleared when the first replacement is logged, so it never comes back once that intervention is deleted.

If neither exists, the task is **overdue with no date**, like an interval task with no date baseline: no `next_due_date`, no `due_in_days`, no `urgency`. `due_trigger` is still `expiry`.

With a date, the rule works like the months rule, with the expiry date as the due date:

- **Overdue** once the expiry date has started (the same instant comparison as the months rule's due date), **due soon** from 30 days before it, **OK** before that.
- `due_in_days` counts whole calendar days from today to the expiry date, as for the months rule.
- `next_due_hours` and `due_in_hours` are always absent: an expiry task has no hours rule, even on an equipment that tracks hours.

### Urgency

`urgency` (number) says how far a task is through its interval: the **fraction of the interval elapsed** since the baseline. It is `0` when the task has just been done, `0.5` half-way, `1` when the due point is reached, and above `1` once it is past (`1.5` = overdue by half an interval). Being a fraction, it compares tasks across triggers and interval lengths: an oil change every 100 h, overdue by 120 h (`2.2`), is more urgent than a hull inspection every 12 months, overdue by 3 days (`1.01`).

| Rule   | Fraction elapsed |
|--------|------------------|
| months | Elapsed days / interval days: (today − date baseline) / (`next_due_date` − date baseline), in whole calendar days counted like `due_in_days` (dates read in the timezone `next_due_date` is computed in). Equivalently `1 − due_in_days / interval days`. |
| hours  | Elapsed hours / interval hours: (current reading − hours baseline) / `hours_interval`. Equivalently `1 − due_in_hours / hours_interval`. |
| expiry | Elapsed days / shelf life left when fitted: (today − date fitted) / (expiry date − date fitted), in whole calendar days counted like `due_in_days`. The date fitted is the latest intervention's `date`. |

For an expiry task:

- Only the **current expiry date** (no intervention yet): there is no date fitted, so **no urgency**. The task ranks after the tasks with the same status that have one.
- A part **fitted already expired** (expiry date on or before the date fitted) has no shelf life to divide by. Its urgency is the **largest number the API can carry** (`1.7976931348623157e308`, the largest double), so it ranks at the top of the overdue tasks. Such a task is always overdue.

- Both rules apply: the **greater** of the two fractions. The task is due when either interval is reached first, so it is as far through its cycle as its furthest rule. This is usually the driving trigger's fraction, but not always: a task due soon by hours whose months rule is still OK, yet further through its interval, takes its urgency from months.
- One rule applies: its fraction.
- No rule applies (see [Driving trigger and amount](#driving-trigger-and-amount)): `urgency` is absent.
- A rule whose interval is not positive (the task form does not allow it) gives no fraction.
- A months rule with **no date baseline** (never performed, equipment without a `commissioned_at`) gives no fraction either: there is nothing to measure elapsed time from. The urgency then comes from the hours rule if it applies, and is absent otherwise. The task is still overdue, and in the ranking it comes after the overdue tasks that have an urgency, then by name.

The fraction is not rounded or clamped: it is negative when the baseline is ahead of now, e.g. a `commissioned_at` in the future, or a current reading below the hours baseline after a meter correction. Such a task simply ranks lower.

It is computed once, with the rest of the Due status. Clients rank tasks with it and never derive urgency from dates or hours themselves.

### Ranking tasks by urgency

Every place that orders tasks, or picks the most urgent one, uses this order, most urgent first:

1. **`due_status`**: overdue, then due soon, then OK.
2. **`urgency`**, highest first. A task without `urgency` comes after those with one, within the same status. This is where a task overdue only because it has no date baseline lands.
3. **`name`**, alphabetically, then **`id`**, ascending. Two tasks never tie, so the order is total and the same on every load.

The status comes first so the order always agrees with it: an overdue task ranks above every due-soon task, and a due-soon task above every OK task, whatever their fractions. The fraction alone would not guarantee this, because the due-soon margins (30 days, 10 h) do not scale with the interval. A task due soon by hours on a 100 h interval can be at `0.92` while an OK task on a 10-year interval is at `0.99`. On the due date, a task due soon by months and an overdue one can both be at `1`.

Where it applies:

- **Dashboard**: the tasks of each equipment block, and the blocks themselves, ordered by their most urgent task (see [gui/dashboard.md](./gui/dashboard.md)).
- **Equipment detail**, Tasks tab: every task (see [gui/tasks.md](./gui/tasks.md)).
- **Equipments list**: the task each card summarises is the first in this order (see [gui/equipments.md](./gui/equipments.md)).

### Date baseline precedence

The date a time-based interval is counted from — and therefore the "next due" date — is resolved in this order:

1. **The most recent intervention's `date`** on that task — the task was actually performed then.
2. **The equipment's `commissioned_at`**, when it is set and is a valid `YYYY-MM-DD` date — the equipment has been in service (and therefore accumulating wear) since then, even though nothing has been logged yet.

If neither exists, there is **no date baseline**: there is no way to know when the task is due, so it is reported **Overdue** and has no "next due" date. The app never invents one.

The equipment's `created_at` is **never** used as a baseline. It is only the moment the record was entered into this app, which says nothing about when the equipment entered service or when the task was last done.

A `commissioned_at` that is absent, empty, or unparseable is treated as unset. It must never be treated as a zero date.

The `next_due_date` is the date baseline plus `months_interval` calendar months, on the same day of the month. When that day does not exist in the target month, it is the **last day of that month**, never a day of the month after: Jan 31 + 1 month = Feb 28 (Feb 29 in a leap year), Aug 31 + 6 months = Feb 28, Feb 29 + 12 months = Feb 28.

### Hours baseline

The hour-meter baseline is the `hours_at` of the most recent intervention on that task **that has a reading**. Interventions logged without `hours_at` are skipped here; they still set the [date baseline](#date-baseline-precedence).

- Never performed: `0`.
- Performed, but no intervention has a reading: there is **no hours baseline**. The hours rule then gives no `next_due_hours`, no status, no `due_in_hours` and no urgency. The task's status comes from the months rule if it has one, and is OK otherwise, until a reading is logged.

`commissioned_at` plays no part here — an hour-meter reading, not a date, is what an hour-based interval is measured against.

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

## Calendar dates and timestamps

Fields typed `date` in the tables above are **calendar dates**. Fields typed `timestamp` are **moments in time**.

| Kind | Fields | What it is |
|------|--------|------------|
| Calendar date | Equipment `commissioned_at`, Intervention `date`, Intervention `expiry_date`, Task `current_expiry_date`, a task's next due date | A day on the calendar (`YYYY-MM-DD`), with no time of day and no timezone |
| Timestamp | `created_at`, `updated_at`, `hours_updated_at`, `uploaded_at` | A moment in time |

- **The date the user picks is the date every page shows**, whatever the browser's timezone. Saving a form without touching its date keeps that date.
- **"Today"**, the default date of a new intervention (quick log and full form), is today in the user's timezone, not in UTC. An intervention date is "in the future" when it is after that day.
- A **timestamp** is shown in the user's timezone: a file uploaded at 00:30 local time on 14 May shows as uploaded on 14 May.
- The frontend handles calendar dates in one module, `frontend/src/lib/calendar-date.ts`: today's default, form value, request value and display. Timestamps have their own helpers in `frontend/src/lib/timestamp.ts`.
- Transitional: the API still carries the intervention date as a timestamp. The browser sends local midnight of the picked day and reads back the local date of that moment. Issue #72 makes it a plain `YYYY-MM-DD` date in the API and in storage, like the other two.
