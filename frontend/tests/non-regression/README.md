# Non-regression tests

Most specs pin one fixed bug: each reproduces the bug as it appeared, then
asserts the fixed behavior. If the spec fails again, the bug is back. The
others check a flow of `doc/gui/` that no bug spec covered (#150), so that the
React cutover (#146) cannot drop it unnoticed. The [flow map](#flow-map) below
says which spec covers each flow.

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

### Projects

`playwright.config.ts` runs two projects, one after the other, against the
same servers and database:

- `chromium`: a desktop browser. It runs every spec except `mobile-*.spec.ts`.
- `mobile`: a phone (Pixel 7, on Chromium). It runs only `smoke.spec.ts`,
  `navigation.spec.ts` and `mobile-*.spec.ts`, so CI time stays reasonable.

`pnpm test` runs both. `pnpm test --project=mobile` runs one. A spec that runs
in both projects runs twice on one database, so it must not rely on a name
being unique.

## Adding a new test

1. Name the file after the bug, kebab-case: `safedate-shows-nan.spec.ts`.
   A spec for a `doc/gui/` flow is named after the flow or the screen:
   `equipment-delete.spec.ts`.
2. Top of file, link to the ROADMAP item and commit that fixed it. A flow
   spec's header says "Flow, not a bug", names the `doc/gui/` sections it
   checks and the issue it came from (see the template in the
   non-regression-test skill), and gets a row in the [flow map](#flow-map).
3. Import `test` and `expect` from `../fixtures`, never from
   `@playwright/test`.
4. Keep it short: navigate, act, assert. No page objects, and no fixtures
   besides the shared one. Set data up with `apiPost` from `../fixtures`,
   which fails the test at once when the backend refuses it.
5. Each test must create its own data and not depend on other tests.
6. Find elements by role, label or text, or by a single class when the
   element has neither. No tag names (a locator that names the `select`
   tag) and no nesting inside one selector (a modal class followed by `input`): chain locators to scope. See
   "Locators" in the non-regression-test skill.

## Page errors and console errors fail the test

The shared fixture (`frontend/tests/fixtures.ts`) collects every uncaught page
error and every console message of type `error`, and fails the test with the
list. Chromium logs a console error for each request that gets an HTTP error
status or is aborted, so a test that provokes one on purpose declares it
before the action:

```ts
test('...', async ({ page, expectErrors }) => {
  expectErrors(failedRequest(`/api/equipments/${eq.id}/hours`, 400))
```

Every declared error must be logged, and any other error still fails the
test. Keep declarations narrow. An error the app logs by mistake is a bug: fix
it, or open an issue and declare that exact message with a comment that points
to the issue. End each spec on an assertion: the fixture waits one frame and
one task before the check, not for longer timers. See the non-regression-test
skill (`.agents/skills/non-regression-test/SKILL.md`) for the matchers.

The fixture also keeps the suite off the internet. The Google Fonts
stylesheet is answered with an empty one, so no font file is downloaded and
the pages use the fallback fonts. Any other request that leaves `localhost`
is blocked, which fails the test. Requests to the app itself are not touched.

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
| `dashboard-done-defaults-to-local-date.spec.ts` | Dashboard Done (then the quick log) pre-filled the UTC date instead of the local date (issue #71) | — |
| `manual-update-check.spec.ts` | Feature, not a bug: Settings "Check for updates" button shows a busy state, then a newer version, up to date, a reused result or the failure reason (issue #57). API mocked, never reaches GitHub | — |
| `history-edit-keeps-equipment.spec.ts` | Editing an intervention from the global History screen lost its equipment: empty Task list, no Hours field, and an exceptional intervention could not be saved (issue #73) | — |
| `intervention-form-keeps-input-on-data-load.spec.ts` | The full intervention form was rebuilt and lost what the user typed when the page data arrived while it was open (slow first load of History) (issue #73) | — |
| `dashboard-done-error-shows-reason.spec.ts` | A failed Dashboard Done showed "Failed to save intervention" instead of the backend's reason; the form stays open (issues #74, #107) | — |
| `delete-intervention-asks-about-reading.spec.ts` | Deleting the intervention that set the reading left it unchanged while the confirmation promised it would be "recomputed", with no way to correct it. Now the user is asked: Keep leaves the reading, Correct sets the prefilled highest reading left (issue #70) | — |
| `edit-intervention-asks-about-reading.spec.ts` | Editing the intervention that set the reading (500 h) down to 450 h asks too, on the equipment history and the global History; Correct is prefilled with the edited reading, 450 (issue #70) | — |
| `expiry-task-happy-path.spec.ts` | Feature, not a bug: an expiry task is created with its current expiry date, shows "Expires in N days", and is marked done with the new part's expiry date (issue #99) | — |
| `done-opens-full-form-prefilled.spec.ts` | Done on the Dashboard and Equipment detail opens the full form with the equipment and task selected, today and the current reading (empty when none), saves the location and refreshes the list (issue #107, replaces the #97 quick-log location spec) | — |
| `equipment-hours-error-shows-reason.spec.ts` | The equipment create modal and "Update hours" showed "Failed to add equipment" / "Failed to update hours" instead of the backend's reason, e.g. "Hours cannot be negative" (issue #102) | — |
| `dashboard-refreshes-with-other-due-tasks.spec.ts` | After Done was saved on the Dashboard, the task stayed listed as overdue whenever another equipment still had a due task: the due list kept its first render (issue #109) | — |
| `equipment-groups.spec.ts` | Feature, not a bug: a group created from the equipment form lists its equipments, shows its worst status and stays collapsed after a reload; deleting a group keeps its equipments; the detail-header icon change keeps the group; the History filter shows a group's interventions; a group created then the form cancelled shows as an empty section without duplicating the list (issue #112) | — |
| `decommissioned-equipment.spec.ts` | Feature, not a bug: decommissioning an equipment from the edit form shows its badge, takes it off the Dashboard (due tasks and hour-meter reminder) and the Equipments list until "Show decommissioned" shows it dimmed in its group, and the intervention form still lists it last, marked (issue #113) | — |
| `equipment-upload-error-shows-reason.spec.ts` | A refused document upload showed "Failed to upload document" instead of the backend's reason, e.g. "file exceeds the 50 MB limit" (issue #119) | — |
| `missing-file-says-so.spec.ts` | A document whose file was gone from the server showed "0 B" with a failing Download link, and a missing photo showed a broken image; both now say "missing on server" and can still be deleted; after a delete shifts the list, each row and photo tile still shows its own file (issue #122), and the delete logs no uncaught Arrow.js error (issue #139) | — |
| `photo-upload-error-shows-reason.spec.ts` | A refused photo upload showed "Failed to upload photo" instead of the backend's reason, e.g. "file exceeds the 10 MB limit" or "only JPEG, PNG, WebP and GIF images are allowed"; the generic message stays when the response gives no reason (issue #129) | — |
| `dashboard-no-same-hours-without-reading.spec.ts` | The dashboard hour-meter banner offered "Same hours" for an equipment with no reading yet, and one tap recorded 0 h the user never entered; its row now offers only Update (issue #130) | — |
| `navigation.spec.ts` | Flow, not a bug: `/` lands on the Dashboard, each section is one click away in the navigation the viewport shows and is highlighted once open (Equipments on an equipment page too), the app name goes to the Dashboard. Runs in both projects (issue #150) | — |
| `mobile-tab-bar.spec.ts` | Flow, not a bug, `mobile` project only: the bottom tab bar replaces the top navbar, has four tabs with an icon and a label, opens and highlights each section when tapped, and stays at the bottom while the page scrolls. On a portrait tablet it is a `test.fixme` (issue #174) (issue #150) | — |
| `mobile-layout.spec.ts` | Flow, not a bug, `mobile` project only: the add-equipment form, opened by whichever add control shows, fits a phone screen; History shows cards, the date under the task, with no table header. The floating + button is a `test.fixme` (issue #168) (issue #150) | — |
| `equipment-delete.spec.ts` | Flow, not a bug: Delete in the equipment header asks first, then removes the equipment with its tasks, interventions and files and keeps its group; Cancel keeps it. The warning about attached files is a `test.fixme` (issue #169) (issue #150) | — |
| `equipment-update-hours.spec.ts` | Flow, not a bug: Update hours from the header saves a higher reading; a lower one cannot be saved; the same one refreshes the freshness; Update on a stale Dashboard banner row opens the same form and the row leaves the stale list (issue #150) | — |
| `equipment-correct-reading.spec.ts` | Flow, not a bug: Correct reading from the header starts empty, refuses empty or negative and can lower the reading; `?hours=` prefills it; Cancel changes nothing (issue #150) | — |
| `equipment-list-and-detail.spec.ts` | Flow, not a bug: an equipment card shows its description, hour-meter, last intervention and most urgent task, and opens the Tasks tab; the History, Documents and Info tabs; the equipment name on a Dashboard block, and on an hour-meter banner row, opens it (issue #150) | — |
| `equipment-create-and-decommission.spec.ts` | Flow, not a bug: adding an equipment with an hour-meter starts it at its initial reading, fresh, with the default icon (no floating + button on desktop); the decommissioning date's limits, the task rows' missing urgency indicator, and clearing it puts the equipment back in service; a decommissioned equipment's rows keep Done, Edit and Delete, and Done logs work dated after the decommissioning (issue #150) | — |
| `equipment-documents.spec.ts` | Flow, not a bug: a document uploads to the real backend, downloads under its name, and is deleted after a confirmation (issue #150) | — |
| `group-rename.spec.ts` | Flow, not a bug: Rename a group (a name another group has is refused, Cancel changes nothing) and Change icon from its section's menu (issue #150) | — |
| `group-picker.spec.ts` | Flow, not a bug: the equipment form's Group picker lists No group, the groups by name, then + New group; "+ New group" refuses a name another group has. Its Cancel putting the picker back is a `test.fixme` (issue #175) (issue #150) | — |
| `task-edit-delete.spec.ts` | Flow, not a bug: the Tasks tab's empty state and its call to add the first task, which needs an interval; Edit opens the form prefilled without the kind choice; Delete warns that the interventions go too (issue #150) | — |
| `history-log-and-layout.spec.ts` | Flow, not a bug: a backdated and an exceptional intervention logged from History (the exceptional one leaves its task due), the ⓘ tooltip, and an exceptional entry listed like a standard one; the date range filter; the table layout with its header row on a wide screen (issue #150) | — |
| `intervention-photos-and-hours.spec.ts` | Flow, not a bug: a photo added to a past intervention shows in the grid and the history, opens full screen and is deleted; a reading lower than the equipment's is saved without lowering it. Its inline warning is a `test.fixme` (issue #172) (issue #150) | — |
| `hour-meter-toggle.spec.ts` | Flow, not a bug: turned back on, the hour-meter is prefilled with its last reading and cannot go lower. The warning when turning it off (confirm saves, Cancel keeps it on) is two `test.fixme` (issue #171) (issue #150) | — |
| `settings.spec.ts` | Flow, not a bug: the theme follows the system until one is chosen, applies at once and stays after a reload; the Backup section (enabled with files, enabled with none, disabled); the About section (issue #150) | — |
| `empty-states.spec.ts` | Flow, not a bug: the empty Dashboard, Equipments list (none at all, or none in service) and History, with their calls to action (lists stubbed: the run shares one database). History with equipments but nothing logged is a `test.fixme` (issue #170) (issue #150) | — |

## Flow map

Every flow of `doc/gui/` and the specs that check it. *Uncovered* says why no
spec does. A `test.fixme` is a spec the app fails today: the issue it points to
is the bug.

### Navigation (`doc/gui/navigation.md`)

| Flow | Spec |
|---|---|
| `/` lands on the Dashboard | `navigation.spec.ts` |
| Desktop top navbar: the four sections, the active one highlighted, the app name goes to the Dashboard | `navigation.spec.ts` |
| Mobile bottom tab bar: four tabs with icon and label, active one highlighted, fixed to the bottom | `navigation.spec.ts` (`mobile` project), `mobile-tab-bar.spec.ts` |
| Tablet portrait: the bottom tab bar | `mobile-tab-bar.spec.ts`: `test.fixme`, issue #174 (the app switches at 640 px; the doc may be what changes) |
| Theme follows the system by default | `settings.spec.ts` |
| Page title of each screen | `navigation.spec.ts` (Dashboard), `equipment-page-title.spec.ts` (equipment) |

### Dashboard (`doc/gui/dashboard.md`)

| Flow | Spec |
|---|---|
| Hour-meter banner: hour-tracked equipments in service, hours, relative time, stale rows emphasized | `freshness-reminder-dismiss-immediate.spec.ts`, `equipment-update-hours.spec.ts`, `decommissioned-equipment.spec.ts` |
| Banner: fresh rows folded away | `equipment-update-hours.spec.ts` |
| Banner row: the equipment name opens its detail | `equipment-list-and-detail.spec.ts` |
| Banner: rows oldest first | Uncovered here: the order is a rule in `src/lib/hourMeterFreshness.ts`, checked by its Vitest test; a spec would need several fixed timestamps |
| Banner: Same hours, and none without a reading | `freshness-reminder-dismiss-immediate.spec.ts`, `dashboard-no-same-hours-without-reading.spec.ts` |
| Flow: Update an hour-meter from the banner | `equipment-update-hours.spec.ts` |
| Upcoming tasks grouped by equipment, overdue and due soon only, in urgency order | `tasks-ordered-by-urgency.spec.ts`, `dashboard-refreshes-with-other-due-tasks.spec.ts` |
| Timing text | `overdue-hours-shows-hours-not-future-date.spec.ts`, `equipments-overdue-hours-shows-hours-not-today.spec.ts`, `expiry-task-happy-path.spec.ts`, `equipment-list-and-detail.spec.ts` ("never done") |
| Flow: Log an intervention from the dashboard (Done) | `done-opens-full-form-prefilled.spec.ts`, `dashboard-done-defaults-to-local-date.spec.ts`, `dashboard-done-error-shows-reason.spec.ts`, `dashboard-refreshes-with-other-due-tasks.spec.ts`, `mark-done-modal-stays-open.spec.ts` |
| Flow: Jump to an equipment | `equipment-list-and-detail.spec.ts` |
| Decommissioned equipment never on the Dashboard | `decommissioned-equipment.spec.ts` |
| Empty state, with and without equipments | `empty-states.spec.ts` |

### Equipments (`doc/gui/equipments.md`)

| Flow | Spec |
|---|---|
| List: group sections and cards, alphabetical | `equipment-groups.spec.ts` |
| Section header: count, worst status, collapse remembered per browser, empty group | `equipment-groups.spec.ts` |
| Section header: "All equipments in this group are decommissioned." | Uncovered: a corner of the decommissioned filter, whose main path `decommissioned-equipment.spec.ts` covers |
| Card content: description, hour-meter, last intervention, next due | `equipment-list-and-detail.spec.ts`, `equipments-most-urgent-task-across-triggers.spec.ts`, `equipments-overdue-hours-shows-hours-not-today.spec.ts` |
| Clicking a card opens the detail on the Tasks tab | `equipment-list-and-detail.spec.ts` |
| Show decommissioned, dimmed cards | `decommissioned-equipment.spec.ts` |
| Show decommissioned remembered per browser | Uncovered: the same per-browser storage as collapsed sections, which `equipment-groups.spec.ts` checks after a reload |
| "+ Add equipment" on desktop, no floating button there | `equipment-create-and-decommission.spec.ts`, `equipment-groups.spec.ts` |
| Floating action button on mobile | `mobile-layout.spec.ts`: `test.fixme`, issue #168. Whether a phone keeps the header button too is open, so the passing phone test taps whichever add control shows |
| Empty state: no equipment and no group | `empty-states.spec.ts` |
| Empty state: every equipment decommissioned: "No equipments in service.", with Show decommissioned | `empty-states.spec.ts` |
| Detail header: icon picker, Decommissioned badge, Edit / Delete, hours with Update hours and Correct reading | `equipment-groups.spec.ts`, `decommissioned-equipment.spec.ts`, `equipment-update-hours.spec.ts`, `equipment-correct-reading.spec.ts`, `equipment-delete.spec.ts` |
| Tabs: Tasks (default), History, Documents, Info | `equipment-list-and-detail.spec.ts` |
| Documents tab: list, upload, download, delete | `equipment-documents.spec.ts` |
| Documents tab: refused upload, missing file | `equipment-upload-error-shows-reason.spec.ts`, `missing-file-says-so.spec.ts` |
| Flow: Add an equipment (with an hour-meter) | `equipment-create-and-decommission.spec.ts`, `equipment-hours-error-shows-reason.spec.ts` |
| Picking an emoji in the icon picker | Uncovered: the grid is the third-party `emoji-picker-element`, inside its shadow DOM; its Reset button, which saves the same way, is covered by `equipment-groups.spec.ts` and `group-rename.spec.ts` |
| The Group picker: No group, the groups by name, + New group last | `group-picker.spec.ts` |
| The Group picker: "+ New group" creates the group at once and selects it; it stays if the form is cancelled | `equipment-groups.spec.ts` |
| The Group picker: a name another group has is refused | `group-picker.spec.ts` |
| The Group picker: Cancel puts the picker back to its previous value | `group-picker.spec.ts`: `test.fixme`, issue #175 |
| Flow: Decommission an equipment, its date limits, back in service | `decommissioned-equipment.spec.ts`, `equipment-create-and-decommission.spec.ts` |
| Flow: Update hour-meter | `equipment-update-hours.spec.ts`, `equipment-hours-error-shows-reason.spec.ts` |
| Flow: Correct the reading, `?hours=` prefill | `equipment-correct-reading.spec.ts`, `delete-intervention-asks-about-reading.spec.ts` |
| Flow: Toggle hour-meter: turning it on | `equipment-edit-keeps-hour-meter.spec.ts`, `confirm-tracks-modal-no-loop.spec.ts`, `confirm-tracks-modal-only-on-toggle.spec.ts`, `hour-meter-toggle.spec.ts` |
| Flow: Toggle hour-meter: turning it off warns about the tasks with an hours interval, saves once confirmed, Cancel keeps it on | `hour-meter-toggle.spec.ts`: `test.fixme`, issue #171 |
| Editing an equipment leaves its reading alone | `equipment-edit-keeps-hour-meter.spec.ts` |
| Flow: Change the icon | `equipment-groups.spec.ts` |
| Flow: Delete an equipment | `equipment-delete.spec.ts`; its warning about files: `test.fixme`, issue #169 |
| Flow: Manage a group: Rename, Change icon | `group-rename.spec.ts` |
| Flow: Manage a group: Delete | `equipment-groups.spec.ts` |
| Commissioning date shown as picked | `commissioning-date-no-off-by-one.spec.ts`, `date-shifts-back-east-of-utc.spec.ts` |

### Tasks (`doc/gui/tasks.md`)

| Flow | Spec |
|---|---|
| Row: name, trigger summary, urgency, last intervention | `interval-display-deduplication.spec.ts`, `task-last-date-updates-after-mark-done.spec.ts`, `expiry-task-happy-path.spec.ts` |
| Urgency order | `tasks-ordered-by-urgency.spec.ts` |
| Decommissioned equipment: no urgency indicator | `equipment-create-and-decommission.spec.ts` |
| Decommissioned equipment: Done, Edit and Delete stay | `equipment-create-and-decommission.spec.ts` |
| Decommissioned equipment: tasks in name order | Uncovered: the order is `byUrgency` in `src/lib/urgency.ts`, checked by its Vitest test |
| Empty state | `task-edit-delete.spec.ts` |
| Task form: kind, validation | `task-edit-delete.spec.ts`, `expiry-task-happy-path.spec.ts` |
| Flow: Add a task | `task-list-appears-after-add.spec.ts`, `task-edit-delete.spec.ts`, `expiry-task-happy-path.spec.ts` |
| Flow: Edit a task | `task-edit-delete.spec.ts`, `expiry-task-happy-path.spec.ts` |
| Flow: Delete a task | `task-edit-delete.spec.ts` |
| Flow: Mark a task as done | `done-opens-full-form-prefilled.spec.ts`, `equipment-task-refresh.spec.ts`, `task-last-date-updates-after-mark-done.spec.ts` |
| Photos on tasks | Uncovered: not built yet (issue #26) |

### Interventions (`doc/gui/interventions.md`)

| Flow | Spec |
|---|---|
| Opened from Done, prefilled | `done-opens-full-form-prefilled.spec.ts`, `expiry-task-happy-path.spec.ts` |
| Opened from "+ Log intervention" (equipment History tab, global History) | `equipment-history-appears-after-add.spec.ts`, `history-log-and-layout.spec.ts`, `intervention-form-keeps-input-on-data-load.spec.ts` |
| Fields: equipment list with decommissioned last | `decommissioned-equipment.spec.ts` |
| Fields: exceptional intervention, its label, Save disabled until required fields | `history-log-and-layout.spec.ts`, `history-edit-keeps-equipment.spec.ts`, `expiry-task-happy-path.spec.ts` |
| Fields: the ⓘ next to Exceptional intervention shows its tooltip on hover | `history-log-and-layout.spec.ts` |
| Fields: date defaults to today in the user's timezone | `intervention-date-uses-local-timezone.spec.ts`, `dashboard-done-defaults-to-local-date.spec.ts` |
| Validation: date in the future refused with the reason | `intervention-save-error-shows-reason.spec.ts` |
| Validation: no rule against the decommissioning date | `equipment-create-and-decommission.spec.ts` |
| Validation: lower hours allowed, equipment not lowered | `intervention-photos-and-hours.spec.ts` |
| Validation: lower hours show an inline warning | `intervention-photos-and-hours.spec.ts`: `test.fixme`, issue #172 |
| Validation: warning when older than 5 years | Uncovered: optional in the doc, not built |
| Side effects: standard re-computes the task, exceptional does not | `done-opens-full-form-prefilled.spec.ts`, `history-log-and-layout.spec.ts` |
| Editing and deleting, from either History | `history-edit-keeps-equipment.spec.ts`, `history-intervention-delete-refresh.spec.ts`, `date-shifts-back-east-of-utc.spec.ts` |
| Reading in doubt after a delete or an edit | `delete-intervention-asks-about-reading.spec.ts`, `edit-intervention-asks-about-reading.spec.ts` |
| Reading in doubt: not asked when another intervention backs the reading, or the reading changed meanwhile | Uncovered here: rules in `src/lib/readingDoubt.ts`, checked by its Vitest test |
| Photos: add, count badge, full screen, delete | `intervention-photos-and-hours.spec.ts` |
| Photos: save first hint, refused upload, missing photo | `done-opens-full-form-prefilled.spec.ts`, `photo-upload-error-shows-reason.spec.ts`, `missing-file-says-so.spec.ts` |

### History (`doc/gui/history.md`)

| Flow | Spec |
|---|---|
| Rows: date, equipment, task, hours, location, comments, Edit, Delete | `history-log-and-layout.spec.ts`, `mobile-layout.spec.ts`, `history-edit-keeps-equipment.spec.ts`, `safedate-shows-nan.spec.ts` |
| Exceptional interventions listed like any other entry | `history-log-and-layout.spec.ts` |
| Table on a wide screen, full detail on hover | `history-log-and-layout.spec.ts` |
| Cards on a phone | `mobile-layout.spec.ts` |
| Filter: equipment | `history-filters-refresh.spec.ts` |
| Filter: group, decommissioned equipment listed | `equipment-groups.spec.ts`, `decommissioned-equipment.spec.ts` |
| Filter: date range | `history-log-and-layout.spec.ts` |
| Empty state, global, no equipment | `empty-states.spec.ts` |
| Empty state, global, equipments but nothing logged | `empty-states.spec.ts`: `test.fixme`, issue #170 |
| Empty state, per equipment | `equipment-history-appears-after-add.spec.ts`, `task-edit-delete.spec.ts` |
| Flow: Inspect or edit a past intervention | `history-edit-keeps-equipment.spec.ts`, `edit-intervention-asks-about-reading.spec.ts` |
| Flow: Backdated intervention | `history-log-and-layout.spec.ts` |

### Settings (`doc/gui/settings.md`)

| Flow | Spec |
|---|---|
| Appearance: theme | `settings.spec.ts` |
| Localisation: language, date, time and number formats, first day of the week | Uncovered: not built yet (the Settings screen has no Localisation section) |
| About: version, repository link, license | `settings.spec.ts` |
| About: update status and Check for updates | `manual-update-check.spec.ts`, `update-status-not-shown-when-check-pending.spec.ts` |
| Backup: status, directory, retention, files | `settings.spec.ts` |

### Where the app and the doc word things differently

Not bugs: the meaning is the same. The specs use the app's words, so a port
that keeps the app's texts keeps them passing; a change to one of these texts
must change the specs that use it.

- The Dashboard banner's button reads **Update**, not "Update hours".
- Relative times are short: **updated 10d ago**, not "updated 3 days ago".
- An equipment card with every task OK reads **OK · All clear!**, not "All tasks OK".
- A task's trigger reads **Every 100h or 6mo**, not "Every 100 h or 6 months".
- Deleting a document asks **Delete *name*? This cannot be undone.**, not "Delete this file?".
- Deleting an equipment is a page (`/equipments/:id/delete`), not a modal.
- The Equipments empty state's call is a link, **Add your first equipment**, not a "+ Add your first equipment" button.
- The global History table's column reads **Equipment / Task**.

### Where the doc is wrong

Not bugs in the app, so no spec pins the doc's version. They are for the
maintainer to fix in `doc/gui/`.

- `equipments.md`, "Flow: Toggle hour-meter on an existing equipment", step 1
  says the user goes to the Info tab. The toggle is on the edit form
  (`/equipments/:id/edit`); the Info tab only shows it, as the same file's
  "Tabs" section says.

### Where the doc and the app disagree, undecided

- `navigation.md` gives a portrait tablet the bottom tab bar; the app gives it
  the top navbar, and `tasks.md` and `history.md` treat a tablet as a wide
  screen. Issue #174 asks which one changes; its spec is a `test.fixme`.
- `equipments.md` puts the add button "top-right on desktop, floating action
  button on mobile", and does not say whether a phone keeps the header button
  too. Issue #168 has the question; the passing phone spec accepts either.
