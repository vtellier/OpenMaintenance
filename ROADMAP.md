# Roadmap

> This file tracks development progress. Check items off after completing them.
> Specifications are in `doc/` — this file must remain consistent with it.

## Milestone 1 — Data Model Completion

- [x] Add `tracks_hours`, `hours`, `hours_updated_at` to OpenAPI `Equipment` schema
- [x] Add `tracks_hours`, `hours`, `hours_updated_at` to Equipment DB table and Go model
- [x] Update backend handlers for new Equipment fields
- [x] Add `hours_at` to OpenAPI `Intervention` schema
- [x] Add `hours_at` to Intervention DB table and Go model
- [x] Update backend handlers for new Intervention fields
- [x] Regenerate TypeScript API client (`pnpm run generate:api`)

## Milestone 2 — Business Logic

- [x] Compute derived due-status (overdue / due soon / OK) on Task responses
- [x] Cascade delete: equipment → tasks → interventions
- [x] Auto-update equipment hours when an intervention records higher `hours_at`
- [x] Validate intervention `date` is not in the future
- [x] Validate hour-meter constraints (hours_interval only if tracks_hours)
- [x] **No negative hour reading** (issue #102): `hours_at` and every explicit reading (creation, turning tracking on, "Update hours") must be 0 or more; a negative one is a 400 with a reason
- [x] **Hours baseline skips interventions without a reading** (issue #81): counted from the most recent `hours_at` on the task; a task done but never with a reading has no hours rule until one is logged, instead of counting from 0 and turning overdue at once
- [x] **Reading never lowered silently** (issue #70): deleting or editing down an intervention keeps the equipment's reading; when the reading may have come from it, the user keeps it or corrects it ("Correct reading", prefilled with the highest reading left), the only path that can lower it
- [x] **Month-end next due date** (issue #80): adding months clamps to the target month's last day (Jan 31 + 1 month = Feb 28/29) instead of rolling over to early March

## Milestone 3 — Frontend Foundation

- [x] URL routing (all 6 routes: `/`, `/equipments`, `/equipments/:id`, `/equipments/:id/history`, `/equipments/:id/info`, `/history`, `/settings`)
- [x] Navigation shell (top navbar on desktop, bottom tab bar on mobile)
- [x] Light/dark/auto theme support
- [x] Responsive layout

## Milestone 4 — Equipment Screens

- [x] Equipment list (grid of cards with name, description, hour-meter, last intervention, next due)
- [x] Equipment detail screen with 3 tabs: Tasks, History, Info
- [x] Add equipment flow
- [x] Edit equipment flow
- [x] Delete equipment (with confirmation)
- [x] Hour-meter update flow (reachable from dashboard, equipment detail, and equipment list)
- [x] Confirm before enabling `tracks_hours` on existing equipment that has tasks using `hours_interval`

## Milestone 5 — Task Management

- [x] Task list with urgency indicators (overdue = red, due soon = amber) + relative-time display
- [x] Add task flow (modal with name, description, intervals)
- [x] Edit task flow (modal with prefilled form)
- [x] Delete task (modal with cascade-delete warning)
- [x] "Mark done" quick-log from task row (opens intervention quick-log modal pre-filled with task)
- [x] **Expiry tasks** (issue #99): a task kind, fixed at creation, for parts due on a printed expiry date; each intervention records the new part's expiry date, and the task form asks for the current one until the first is logged

## Milestone 6 — Bug Fixes

### Critical
- [x] **Date format mismatch**: change Intervention `date` field in OpenAPI spec from `format: date` to `format: date-time`, regenerate TS client — fixes HTTP 400 on all intervention saves
- [x] **`hours_updated_at` never set**: backend `CreateEquipment` and `UpdateEquipment` must set `hours_updated_at = now` when `tracks_hours` is true and hours increase
- [x] **Date formatting shows NaN everywhere**: frontend `safeDate()` in `format.ts` uses `Number(date)` which returns `NaN` for date strings — replace with `new Date(date)`

### Minor
- [x] Page title shows generic "Equipment #N" instead of the actual equipment name
- [x] Interval display shows "Every 100h or Every 6mo" — remove the redundant second "Every"

## Milestone 7 — Dashboard

_Depends on Milestone 6 (quick-log must work, `hours_updated_at` must be set, dates must display correctly)._

- [x] Hour-meter freshness banner (collapsible, stale entries emphasized, "Update hours" CTA per equipment)
- [x] **"Same hours" dismissal** (issue #16): per-row shortcut + dedicated `PUT /equipments/{id}/hours` endpoint that refreshes `hours_updated_at` even when the value is unchanged
- [x] Tasks grouped by equipment, sorted by urgency (overdue/due-soon only; OK tasks hidden)
- [x] "Mark done" quick-log from each task row
- [x] Empty state: "You're all caught up. Nothing due right now." + CTA if no equipments exist

## Milestone 8 — Interventions & Global History

- [x] Full intervention form (equipment picker, task picker, date, hours, location, comments)
- [x] Global history screen (reverse-chronological list, filter by equipment and date range)
- [x] "+" log intervention CTA from global History and per-equipment History tab
- [x] Edit intervention from history (global + per-equipment)
- [x] Delete intervention from history with confirmation (global + per-equipment)
- [x] **One intervention form module** (issue #73): prefill, validation, request and error reason live in `src/lib/interventionForm.ts`; editing from the global History no longer loses the equipment (empty Task list, no Hours field, exceptional entry unsavable), and the reading is sent whenever the equipment tracks hours
- [x] **Quick log uses the intervention form module** (issue #74): the Dashboard and Equipment detail "Mark done" logs share one modal that prefills and saves through `interventionForm.ts`; a refused Dashboard quick log now shows the backend's reason, and an empty reading sends none
- [x] **Location in the quick log** (issue #97): the "Mark done" quick log asks for an optional Location between Hours and Done by, sent trimmed when not blank
- [x] **Done opens the full form, prefilled** (issue #107): Done on the Dashboard and Equipment detail opens the intervention form with the equipment and task selected, today's date and the current reading (empty when none); the quick-log popup is gone

## Milestone 9 — Settings

- [x] Theme toggle (Auto / Light / Dark)
- [x] About section (version, repo link, license)

## Milestone 10 — Reactivity Bug Fixes

- [x] **Task list not refreshed after add**: task list stays empty after saving a new task — requires page reload to appear
- [x] **Task card not updated after mark done**: "Last: never" stays stale after logging an intervention — requires page reload to reflect the new date
- [x] **Dashboard kept a task marked done** (issue #109): the task stayed listed as overdue while another equipment still had a due task

## Milestone 11 — Regionalisation

_Depends on Milestones 1–10 (all UI text must exist before it can be translated)._

- [ ] Locale detection: read `navigator.language` on first launch, map to supported language, seed format defaults
- [ ] Persist all five locale settings in localStorage (`openmaintenance:locale:*`)
- [ ] i18n infrastructure: translation file structure and loading mechanism
- [ ] English translations (baseline)
- [ ] French translations
- [ ] Spanish translations
- [ ] German translations
- [ ] Make `formatDate()` locale-aware (DD/MM/YYYY · MM/DD/YYYY · YYYY-MM-DD)
- [ ] Make `relativeTime()` and `dueRelative()` locale-aware (translated strings)
- [ ] Make `formatHours()` use the user-chosen number format (1,234.5 · 1.234,5 · 1 234,5)
- [ ] Settings UI: Language picker (English / French / Spanish / German)
- [ ] Settings UI: Date format picker (3 options)
- [ ] Settings UI: Time format picker (24-hour · 12-hour)
- [ ] Settings UI: First day of week picker (Monday · Sunday)
- [ ] Settings UI: Number format picker (3 options)
- [ ] Update `document.documentElement.lang` when language changes

## Milestone 12 — Deployment Configuration

- [x] `config.yaml` auto-created next to binary with defaults on first run
- [x] Configurable server port (default: `3001`)
- [x] Configurable database path (default: `./maintenance.db`, relative to binary)

## Milestone 13 — Database Versioning

- [x] `meta` key/value table storing `schema_version` and `app_version`
- [x] Migration runner: bootstrap pre-meta DBs as v1, refuse future DBs, apply numbered migrations forward-only
- [x] Spec: `doc/db-migration.md`

## Milestone 14 — Equipment Documents (issue #3)

- [x] `equipment_files` table (migration v5) + `files/` directory on disk next to the DB
- [x] API: list / upload / download / delete documents under `/equipments/{id}/files`
- [x] Documents tab on the equipment detail screen (upload, list, download, delete)
- [x] Files removed from disk on document delete and on equipment delete (cascade)
- [x] Spec: `doc/file-storage.md`
- [x] Documents up to 50 MB, enough for real manuals; a refused upload shows the server's reason, e.g. "file exceeds the 50 MB limit" (issue #119)

## Milestone 15 — Intervention Photos (issue #25)

- [x] `intervention_files` table (migration v6); `CurrentSchemaVersion` → 6
- [x] API: list / upload / serve / delete photos under `/interventions/{id}/files` (images only, 10 MB, served inline)
- [x] `photo_count` added to the intervention response for the history badge
- [x] Photo grid (add / delete / full-screen view) in the full intervention form; photo-count badge in history lists
- [x] Files removed from disk on photo delete and on intervention / task / equipment delete (cascade)
- [x] Spec: `doc/file-storage.md`
- [x] **Missing intervention stops at 404** (issue #92): uploading a photo to an intervention that does not exist no longer writes the file and a DB row; every photo endpoint answers the 404 alone

## Milestone 16 — Equipment Icon (issue #2)

- [x] `equipments.icon` column (migration v7); `CurrentSchemaVersion` → 7
- [x] Mandatory `icon` emoji field on `Equipment` / `EquipmentInput`, defaults to 🔧
- [x] Icon avatar shown on the list cards and the dashboard
- [x] Icon chosen from an emoji picker (searchable, offline-bundled data) in the create/edit forms
- [x] Spec: `doc/data-model.md`, `doc/gui/equipments.md`

## Milestone 17 — Mobile UX Fixes (issues #34, #36, #37)

- [x] **Freshness reminder dismiss** (issue #34): "Same hours" row hides immediately on the dashboard without a page reload
- [x] **Task layout mobile** (issue #36): task cards no longer overflow on small screens
- [x] **Equipment tab bar mobile** (issue #37): tab bar scrolls horizontally on mobile instead of wrapping

## Milestone 18 — Equipment Status Aggregation (issue #38)

- [x] Aggregated status badge per equipment on the Equipments page (OK / Warning / Overdue) derived from task due dates

## Milestone 19 — CI & Release Engineering (issues #31, #43, #61, #86)

- [x] Add `pnpm run typecheck` step to the `build-frontend` CI job so TypeScript errors are caught on every PR
- [x] Fix pre-existing TypeScript errors surfaced by the new typecheck gate (`DashboardPage`, `EquipmentsPage`, `format.ts`)
- [x] Versioned release binary filenames: build targets produce `openmaintenance-vX.Y.Z` alongside the unversioned alias; release job renames before uploading to GitHub Releases
- [x] Delete dead `WelcomeCard.ts` component (imported a module that never existed)
- [x] CI quality gates (issue #61, absorbs #32): `gofmt` and `go vet` in `test-backend`, `make test-backend` widened to `go test ./...`
- [x] New `test-frontend` CI job running the Playwright suite; Playwright `webServer` starts the backend and Vite dev server (or reuses them if already running); `build-backend` now depends on it
- [x] Fix two Playwright specs whose data leaked between tests (`freshness-reminder-dismiss-immediate`, `mark-done-modal-stays-open`)
- [x] Fix two Playwright specs that failed in 30-day months and February (issue #116): the task marked Done on the Dashboard is yearly, so it is OK right after Done in any month
- [x] **Windows binary built with cgo** (issue #86): cross-compiled with MinGW-w64 so the SQLite driver works (the v0.6.0 `.exe` could not open its database); `make check-cgo` fails CI on any backend binary built without cgo
- [x] **Seed refuses a database that holds data** (issue #140): `make seed` checks for any equipment or group first, and on a database that already holds one it creates nothing and exits with the counts and how to wipe it

## Milestone 20 — Backup Visibility in Settings (issue #55)

- [x] New `GET /api/backups` endpoint returning backup config (enabled, path, keep) and file list
- [x] Backup section in Settings page: status, directory, retention, and list of existing `.bak` files
- [x] Spec: `doc/gui/settings.md`

## Milestone 21 — Equipment Groups (issue #112)

- [x] Spec: `doc/data-model.md` (Group, `group_id`), `doc/gui/equipments.md`, `doc/gui/history.md`; ADR 0002; `CONTEXT.md` glossary entry
- [x] `groups` table (schema v9), `GET/POST /groups`, `PUT/DELETE /groups/{id}`, `group_id` on equipments
- [x] Equipments list: collapsible group sections (alphabetical with ungrouped cards, worst status in the header, collapse remembered per browser), Rename / Change icon / Delete
- [x] Group picker with "+ New group" in the equipment create and edit forms
- [x] History equipment filter offers the groups
- Manual order of groups and equipments: out of scope for now

## Milestone 22 — Decommissioned Equipment (issue #113)

- [x] Spec: `doc/data-model.md` (`decommissioned_at`, "Decommissioning", never due), `doc/gui/equipments.md`, `dashboard.md`, `history.md`, `interventions.md`, `tasks.md`; ADR 0003; `CONTEXT.md` glossary entry
- [x] `decommissioned_at` on equipments (schema v10), with its date rules; the tasks of a decommissioned equipment have no due fields
- [x] Edit form "Decommissioned on", detail header badge, date on the Info tab
- [x] Equipments list hides decommissioned equipments; "Show decommissioned" shows them dimmed, in their group
- [x] Left out of the Dashboard and its hour-meter freshness banner; still in History and the intervention forms, marked

## Milestone 23 — Attached Files Stay With Their Database (issues #121, #122, #123, #139)

- [x] **Refuse to start when no attached file is found** (issue #121): a database moved without its `files/` folder stops startup before any backup is written; some missing files only log a warning; the `files/` location is derived in one place
- [x] **A missing attached file says so** (issue #122): the `File` object reports `missing`; a missing document shows "File missing on server" with no Download link, a missing photo shows a placeholder instead of a broken image, and both can still be deleted
- [x] **Deleting a photo logs no error** (issue #139): deleting a photo tile no longer logs Arrow.js's "expressionPool[effect] is not a function"; the row-reuse delete specs fail on any uncaught page error
- [x] **An incomplete backup never rotates a complete one away** (issue #123): when the database references attached files that are not on disk, the startup backup logs how many and skips rotation for that run, reusing `db.CheckFiles`

## Milestone 24 — Attachments in One Module (issues #127, #128, #129, #130, #131, #137, #138)

- [x] **One attachments module** (issue #127): storing, listing, serving, deleting and moving documents and photos, the referenced-files check, and the cascade when an equipment, a task or an intervention is deleted all live in `internal/attachments`; no behaviour change (ADR 0004)
- [x] **Deleting an owner is all or nothing** (issue #128): deleting an equipment, a task or an intervention runs in one transaction, its attachment rows included; on any failure the API answers 500 and nothing is deleted; directories go only after the commit
- [x] **A refused photo upload says why** (issue #129): a photo over 10 MB or a file that is not an image shows the server's reason; "Failed to upload photo" only when the response gives none
- [x] **No "Same hours" for an equipment with no reading** (issue #130): an hour-tracked equipment with no reading yet keeps its Dashboard banner row with only **Update**; "Same hours" never records a reading the user did not enter
- [x] **An intervention and the reading it raises are saved together** (issue #131): logging, editing or moving an intervention stores it and raises the equipment's hour-meter reading in one transaction; on failure the API answers 500 and nothing is saved
- [x] **An upload is on disk before its row is stored** (issue #138): an uploaded file is flushed and its close checked; a failed flush or close, or no random name to give it, fails the upload with no file and no row left behind
- [x] **The 10 MB photo cap has a backend test** (issue #137): a photo over 10 MB answers 413 with the limit and leaves nothing behind; a photo of exactly 10 MB is accepted

## Milestone 25 — Plain React Replaces Arrow.js (epic #146, ADR 0005)

- [x] **0.1 The Playwright suite is stable over repeated runs** (issue #147): five full runs in a row pass locally and in CI; no `waitForTimeout` left in `frontend/tests/`
- [x] **0.2 Any page error or console error fails a Playwright test** (issue #148): every spec imports `test` and `expect` from `frontend/tests/fixtures.ts`, which fails a test on an uncaught page error or a console error it did not declare; the error specs declare the failed request they provoke
- [x] **0.3 Specs find elements by role, label or text, not by markup** (issue #149): no tag-name or descendant locator left in `frontend/tests/`; the intervention form's and hour fields' controls carry the name of their visible label; the selector rule is in the non-regression-test skill
- [x] **0.4 The suite covers the screens it missed** (issue #150): every flow of `doc/gui/` is mapped to a spec in `frontend/tests/non-regression/README.md`, or listed as uncovered with the reason; new specs cover deleting an equipment, Update hours, Correct reading (with `?hours=`), the rest of the uncovered flows, and a `mobile` Playwright project (Pixel 7) runs the navigation, smoke and `mobile-*` specs with the tab bar; seven app bugs or doc gaps found on the way are `test.fixme` specs (issues #168 to #172, #174, #175)
- [x] **0.5 The suite runs against the production build** (issue #151): `pnpm test:prod` builds with `make build` and runs both Playwright projects against the binary, started from a temporary directory with its own `config.yaml` (port 3201, its own database); `OM_TEST_BASE_URL` moves the whole suite (pages, global setup, every API call) to any running server, which 1.1 uses for the reference app; the `test-frontend-prod` CI job runs it on every pull request
- [x] **0.6 API objects become display rows in one tested module** (issue #152): `frontend/src/lib/rows.ts` turns equipments, tasks, interventions, groups, files and backups into rows (calendar dates as days, timestamps as ISO strings), with Vitest tests under every configured timezone; no page or component calls `fromApiDate`, `fromApiDateTime` or `toISOString` any more, and no conversion is typed `any`
- [x] **0.7 The screen rules move out of the pages into src/lib** (issue #153): the Dashboard's blocks and hour-meter split, the equipment card's lines, the Equipments list's remembered state (behind a storage interface), which interventions belong to an equipment or a task, and History's list, date range and `g:<id>` filter value are plain functions in `frontend/src/lib/` (`dashboard.ts`, `equipmentCard.ts`, `equipmentsListPrefs.ts`, `interventions.ts`, `history.ts`, `hourMeterFreshness.ts`), each with Vitest tests; the pages call them
- [x] **0.8 The form rules and save flows move out of the pages into src/lib** (issue #154): what the task form, Add equipment, the equipment edit form, Update hours and Correct reading require, how they are prefilled (`?hours=` included) and the request each saves are plain functions in `frontend/src/lib/` (`taskForm.ts`, `equipmentForm.ts`, `hoursForm.ts`), each with Vitest tests; the hour-meter confirmation is `saveEdit`, tested with a fake client; no page or component calls `toApiDate` any more

## Future (post-V1)

- Configurable "due soon" window
- Configurable hour-meter staleness threshold
- Configurable date format
- CSV export
- Email/push notifications
- File attachments — equipment documents (#3) and intervention photos (#25) done; task photos (#26) pending
- Equipment icon (#2) done; equipment picture dropped from scope
- Backup of attached files (#27)
- Mobile app (native)

> See [`doc/overview.md`](./doc/overview.md) for the product vision and [`doc/data-model.md`](./doc/data-model.md) for data model details.
