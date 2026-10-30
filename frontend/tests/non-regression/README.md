# Non-regression tests

One spec per fixed bug. Each spec reproduces the bug as it appeared, then
asserts the fixed behavior. If the spec fails again, the bug is back.

## Running

```sh
cd frontend && pnpm test
```

Playwright's `webServer` (see `frontend/playwright.config.ts`) starts the
backend (`go run .`, :3001) and the Vite dev server (`pnpm dev`, :5173) itself.
If both are already running (e.g. `make dev`), they are reused as-is.

> **Warning: this deletes your data.** When Playwright starts the backend
> itself, that backend uses `backend/maintenance.db` — the same database as
> `make dev`. The global setup (`frontend/tests/global-setup.ts`) then deletes
> every equipment in it via the REST API (cascading to tasks and
> interventions). Running the suite against already-running dev servers did
> exactly the same. Back up `backend/maintenance.db` first if it holds data
> you want to keep.

## Adding a new test

1. Name the file after the bug, kebab-case: `safedate-shows-nan.spec.ts`.
2. Top of file, link to the ROADMAP item and commit that fixed it.
3. Keep it short: navigate, act, assert. No page objects, no fixtures.
4. Each test must create its own data and not depend on other tests.

## Index

| Spec | Bug | Roadmap |
|---|---|---|
| `smoke.spec.ts` | Harness sanity check (not tied to a bug) | — |
| `safedate-shows-nan.spec.ts` | Date formatting shows NaN (Arrow.js reactive wraps Dates in Proxy) | Milestone 6 |
| `equipment-page-title.spec.ts` | Page title shows generic "Equipment #N" instead of equipment name | Milestone 6 |
| `interval-display-deduplication.spec.ts` | "Every 100h or Every 6mo" has redundant "Every" | Milestone 6 |
| `mark-done-modal-stays-open.spec.ts` | Clicking a field inside "Mark done" modal closed it (click event bubbled to overlay) | Milestone 6 |
| `task-list-appears-after-add.spec.ts` | Task list stays empty after adding a task — static Arrow.js expression never re-evaluated | Milestone 10 |
| `task-last-date-updates-after-mark-done.spec.ts` | "Last: never" stays stale after logging an intervention — static `lastLabel` never re-evaluated | Milestone 10 |
| `equipment-history-appears-after-add.spec.ts` | New intervention not shown in per-equipment History tab without page reload | Milestone 10 |
| `commissioning-date-no-off-by-one.spec.ts` | Commissioning date displayed one day off due to UTC/local timezone mismatch | — |
| `confirm-tracks-modal-no-loop.spec.ts` | "Enable hour-meter tracking?" modal re-opened infinitely after clicking Enable | — |
| `history-filters-refresh.spec.ts` | History filter changes did not refresh the intervention list | — |
| `history-intervention-delete-refresh.spec.ts` | Deleting an intervention did not refresh the history list | — |
| `equipment-task-refresh.spec.ts` | Task list did not refresh after marking a task done from the equipment page | — |
| `confirm-tracks-modal-only-on-toggle.spec.ts` | "Enable hour-meter tracking?" modal appeared on every save when hour-meter was already enabled (issue #9) | — |
| `freshness-reminder-dismiss-immediate.spec.ts` | "Same hours" dismissal kept stale row visible until page reload — static Arrow.js expressions not reactive (issue #34) | — |
| `update-status-not-shown-when-check-pending.spec.ts` | Settings page showed "✓ Up to date" when GitHub check hadn't completed (empty latestVersion treated as confirmed up-to-date) (issue #49) | — |
| `intervention-date-uses-local-timezone.spec.ts` | Intervention form pre-fills the next UTC day instead of the local date in negative-UTC-offset timezones (issue #51) | — |
| `intervention-save-error-shows-reason.spec.ts` | Saving intervention with future date showed generic error instead of backend reason (issue #51) | — |
| `overdue-hours-shows-hours-not-future-date.spec.ts` | Overdue task with a future calendar nextDueDate showed "in Xd" instead of hours-based info (issue #52) | — |
| `equipment-edit-keeps-hour-meter.spec.ts` | Saving the equipment edit form reset the hour-meter freshness to "never updated", and its hours field could lower the reading (issue #69) | — |
| `equipments-overdue-hours-shows-hours-not-today.spec.ts` | Equipments page showed "Overdue — today" for a task overdue by hours whose calendar due date is still in the future, instead of the hours overdue (issue #67) | — |
| `equipments-most-urgent-task-across-triggers.spec.ts` | Equipments page picked the wrong most urgent task: a task overdue by hours ranked least overdue when its calendar due date was in the future, and hours past due were compared as clock hours (issue #68) | — |
| `tasks-ordered-by-urgency.spec.ts` | Dashboard and Equipment detail ordered tasks by status only (creation order within a status), not by urgency across triggers (issue #68) | — |
| `date-shifts-back-east-of-utc.spec.ts` | East of UTC, a saved intervention date (UTC+2) or commissioning date (UTC+14) showed one day early, and each edit-and-save moved it back another day (issue #71) | — |
| `dashboard-quick-log-defaults-to-local-date.spec.ts` | Dashboard quick log pre-filled the UTC date instead of the local date (issue #71) | — |
| `manual-update-check.spec.ts` | Feature, not a bug: Settings "Check for updates" button shows a busy state, then a newer version, up to date, a reused result or the failure reason (issue #57). API mocked, never reaches GitHub | — |
| `history-edit-keeps-equipment.spec.ts` | Editing an intervention from the global History screen lost its equipment: empty Task list, no Hours field, and an exceptional intervention could not be saved (issue #73) | — |
| `intervention-form-keeps-input-on-data-load.spec.ts` | The full intervention form was rebuilt and lost what the user typed when the page data arrived while it was open (slow first load of History) (issue #73) | — |
| `dashboard-quick-log-error-shows-reason.spec.ts` | A failed Dashboard quick log showed "Failed to save intervention" instead of the backend's reason (issue #74) | — |
| `delete-intervention-asks-about-reading.spec.ts` | Deleting the intervention that set the reading left it unchanged while the confirmation promised it would be "recomputed", with no way to correct it. Now the user is asked: Keep leaves the reading, Correct sets the prefilled highest reading left (issue #70) | — |
| `edit-intervention-asks-about-reading.spec.ts` | Editing the intervention that set the reading (500 h) down to 450 h asks too, on the equipment history and the global History; Correct is prefilled with the edited reading, 450 (issue #70) | — |
| `expiry-task-happy-path.spec.ts` | Feature, not a bug: an expiry task is created with its current expiry date, shows "Expires in N days", and is marked done with the new part's expiry date (issue #99) | — |
| `quick-log-asks-for-location.spec.ts` | The quick log ("Done" button) had no Location field; it now sits between Hours and Done by and the location is saved trimmed (issue #97) | — |
| `equipment-hours-error-shows-reason.spec.ts` | The equipment create modal and "Update hours" showed "Failed to add equipment" / "Failed to update hours" instead of the backend's reason, e.g. "Hours cannot be negative" (issue #102) | — |
