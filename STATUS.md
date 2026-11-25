# Session Summary

## 2026-06-22 — Backup visibility in Settings (issue #55)

Added a Backup section to the Settings page so users can see where backups are stored and list existing backup files.

**Backend:**
- New `GET /api/backups` endpoint returning backup config (`enabled`, `path`, `keep`) and a list of `.bak` files in the backup directory (name, size, creation timestamp), newest first.
- `Handler` struct now carries `BackupEnabled`, `BackupPath` (absolute), and `BackupKeep` fields — populated from `config.yaml` at startup.
- `main.go` resolves the backup path to an absolute path so the API always shows the full path regardless of whether it was configured as relative.
- New `backend/internal/handlers/backup.go` implements `GetBackupStatus`.

**Frontend (`SettingsPage.ts`):**
- New Backup section (between Appearance and About) showing status, directory, retention policy, and a list of backup files with name, size, and relative timestamp.
- Loads asynchronously via `systemApi.getBackupStatus()`; hidden while loading.
- File list is hidden when backup is disabled; shows "No backups yet." when the directory is empty.

**Spec:** `doc/gui/settings.md` updated with Backup section and layout sketch.

Branch: `claude/issue-55-20260622-1407` — PR pending



## 2026-06-10 — CI & Release Engineering + v0.5.0 (issues #31, #43, PRs #47 #48)

Closed two open PRs, fixed lingering CI gaps, and shipped v0.5.0.

**PR #48 — TypeScript typecheck in CI (issue #31)**
- Added `pnpm run typecheck` step to the `build-frontend` CI job — previously Vite built successfully while hiding TS errors.
- Deleted dead `WelcomeCard.ts` (imported `../data/loadWelcomeCard` which never existed).
- Fixed `DashboardPage`: `entries.map()` could return `null`; changed to empty template `html\`\`` so Arrow.js doesn't reject the array. Added `console.warn` (split across lines per review).
- Fixed `EquipmentsPage`: widened `taskName` parameter from `number | undefined` to `number | null | undefined` to match `Intervention.taskId`; cast grouped tasks as `Record<number, Task[]>` (dates are serialised to strings before storing in reactive state).
- Fixed `format.ts`: widened `formatHours` parameter to accept `number | null | undefined`.

**PR #47 — Versioned release binary filenames (issue #43)**
- Rebased onto updated main after PR #48 merged.
- `Makefile`: replaced `cp` with `ln -sf` for the unversioned Linux alias (lighter; review feedback).
- `README.md`: replaced fragile `openmaintenance-*` glob with `cp backend/bin/openmaintenance` (review feedback).
- `pipeline.yml`: added a "Rename binaries for release" step that renames downloaded artifacts to `openmaintenance-${{ github.ref_name }}[.exe]` before the GitHub Release upload — completing the missing piece the bot lacked permission to push.

**v0.5.0 release**
- Tagged and pushed `v0.5.0` from main. Pipeline ran clean on first attempt.
- Release assets: `openmaintenance-v0.5.0` (Linux) and `openmaintenance-v0.5.0.exe` (Windows).
- Changelog covers all 4 PRs since v0.4.1: seeder tooling (#46), history layout (#44), typecheck fix (#48), versioned binaries (#47).

## 2026-06-06 — Intervention photos (issue #25)

Implemented photo attachments for interventions, the next slice of the file-storage design after equipment documents (#3). Reuses the `filestore` package, the `FileInfo` schema, and the handler/db/test patterns from #3.

**API decision:** endpoints are nested under the *intervention*, not the equipment: `/api/interventions/{id}/files[/{filename}]`. This matches the flat intervention API and deliberately leaves room for interventions not bound to an equipment one day. (Initially scoped as nested under equipment per the doc; changed mid-session.) `doc/file-storage.md` updated with the rationale.

Backend:
- Migration **v6**: `intervention_files (intervention_id, file_path PK, original_name, uploaded_at)`; `CurrentSchemaVersion` → 6
- Files stored at `files/equipments/{eq}/interventions/{inv}/{random}.{ext}` — the equipment is resolved server-side from the intervention. DB holds only the relative path
- **Image-only** validation: MIME content-sniffed from leading bytes (JPEG/PNG/WebP/GIF), 10 MB cap enforced from header **and** while streaming; 415 on wrong type, 413 on oversize, before any write
- Handlers: `ListInterventionFiles`, `UploadInterventionFile`, `GetInterventionFile` (served **inline** with sniffed MIME), `DeleteInterventionFile`
- Cascade: deleting an intervention, its parent task, or its equipment removes the `intervention_files` rows and the on-disk photo dirs
- `photo_count` added to the intervention API response (cheap grouped query) to drive the history badge
- Tests in `tests/intervention_file_test.go`: upload→list→serve→delete, 415 non-image, 404 missing intervention, intervention-delete and equipment-delete cascades

Frontend:
- New reusable `components/InterventionPhotos.ts` — photo grid with add (multi-file), per-photo delete, and full-screen viewer; owns its own reactive state, mounted per form open
- Wired into the shared `FullInterventionModal` (shown only when editing a saved intervention; a hint shows for not-yet-saved ones), used by both the equipment History tab and the global History screen
- Photo-count badge (📷 N photos) on history rows in both screens
- CSS for the grid, thumbnails, delete affordance, badge, and viewer overlay

API spec: 5 new operations (4 file routes + `photo_count` field) in `backend/api/openapi.yaml`; Go and TS clients regenerated. `make build` and all 15 Playwright tests pass.

## 2026-06-06 — File storage design decisions (issues #2, #3, #25, #26)

Resolved the three blocking open questions in `doc/file-storage.md` so the file-attachment feature is implementable:

1. **Original filenames** — added an `original_name` column to `equipment_files`, `task_files`, and `intervention_files`. Recorded at upload; documents download via `Content-Disposition: attachment; filename="<original_name>"`, images serve inline. URLs still use the stored UUID name.
2. **Upload validation & limits** — new section: per-kind MIME allowlists (images for picture/photos, any type for documents), 10 MB images / 25 MB documents caps, content-sniffed MIME (not extension-trusted), 413/415 rejection before any write. Limits are fixed defaults, possibly promoted to `config.yaml` later.
3. **Response shapes** — defined the `File` object (`name`, `original_name`, `size`, `mime_type`, `uploaded_at`, `url`); list returns an array, `POST` returns `201` with one object; clarified `{filename}` in URLs is always the stored UUID name.

Still open: thumbnails/resizing, write atomicity, quotas, serving safety beyond disposition, backup/restore archive format. OpenAPI spec not yet updated (still doc-level).

Commit: `110076f` — doc(file-storage): decide filenames, upload validation, response shapes

## 2026-05-24 — Update notifications (issue #11)

Added a background update check that queries the GitHub Releases API on startup and exposes the result via a new `GET /api/update-status` endpoint. The Settings page "About" section now shows "⬆ vX.Y.Z available — Release notes ↗" when a newer version exists, or "✓ Up to date" when current. No update is performed — the user follows the link to GitHub and updates manually.

- `backend/internal/updater/updater.go` — new package: `CheckLatestRelease` hits the GitHub API, parses the latest tag, and compares using semver
- `backend/internal/handlers/update.go` — `GetUpdateStatus` handler returns cached status
- `backend/internal/handlers/handler.go` — `updateStatus` + `updateStatusMu` fields added
- `backend/main.go` — background goroutine triggers the check after server start
- `backend/api/openapi.yaml` — `GET /update-status` endpoint and `UpdateStatus` schema added
- `frontend/src/pages/SettingsPage.ts` — calls `getUpdateStatus()` on load, renders update badge
- `doc/gui/settings.md` — About section spec updated

Branch: `feat/issue-11-auto-update` (to be created)

## 2026-05-24 — Windows target + CI restructure (issue #13)

Added cross-compilation support for Windows (amd64) and restructured CI into a proper pipeline.

- `Makefile`: explicit `build-backend-linux-amd64` (GOOS=linux GOARCH=amd64) and `build-backend-windows-amd64` targets. `build-backend` delegates to `build-backend-linux-amd64`; `make build` remains Linux-only for local dev.
- `release.yml` → `pipeline.yml`: single workflow with three jobs — `build-frontend` (once), `build-backend` (matrix: linux-amd64, windows-amd64), `release` (tag-only). Triggered on PRs, tags, and manual dispatch. Frontend static files and generated Go stubs passed between jobs via artifacts. Adding a new platform = one matrix row.
- `README.md`: added "Run on Windows" self-hosting section.

Branch: `feat/issue-13-windows-target`


## 2026-05-24 — CI build on pull requests (issue #18, PR #19)

Added `pull_request` to the `on:` triggers in `.github/workflows/release.yml` so the `build` job runs on PR creation and updates. The `release` job is unaffected — it remains tag-only via its existing `if: startsWith(github.ref, 'refs/tags/')` guard.

Branch: `ci/issue-18-build-on-pr` — PR #19

## 2026-05-22 — Infinite confirm-tracks modal loop (issue #9, PR #10)

Fixed a bug in `EquipmentEditPage` where the "Enable hour-meter tracking?" confirmation modal reopened indefinitely when clicking Enable.

**Root cause:** `onSubmit()` re-checked tasks on every call. After the modal set `showConfirmTracks=false` and called `onSubmit()` again, the condition `!state.showConfirmTracks` was true again, triggering the modal a second time — infinitely.

**Arrow.js pitfall discovered during investigation:** `@click="${onSubmit}"` forwards the `PointerEvent` as the first argument. Adding `skipConfirmCheck=false` on the dev build made the event value truthy, which masked the loop entirely (the check never ran and the form saved silently). This is why the bug couldn't be reproduced locally until the source was reverted to v0.2.0.

**Fix:** `@click="${() => onSubmit()}"` on Save (no event forwarded); `onSubmit(skipConfirmCheck=false)` parameter; Enable button passes `onSubmit(true)`.

Non-regression test added first (pinned failing), then fixed: `confirm-tracks-modal-no-loop.spec.ts`.

Branch: `fix/issue-9-confirm-tracks-loop` — PR #10

## 2026-05-22 — Date of commissioning (issue #5, PR #8, v0.2.0)

Added an optional "Date of commissioning" field to Equipment.

**Backend**
- DB schema v4: `ALTER TABLE equipments ADD COLUMN commissioned_at TEXT`
- Go model, OpenAPI spec, and DB queries (INSERT/UPDATE/SELECT) updated

**Frontend**
- Add modal (`EquipmentsPage`): date input field; saved as `YYYY-MM-DD`
- Edit page (`EquipmentEditPage`): date input pre-filled on load
- Equipment detail header: shows "Commissioned YYYY-MM-DD" when set
- Info tab (`EquipmentDetailPage`): shows commissioning date between Description and hour-meter toggle

**Bug fixed: off-by-one on date display**
`formatDate()` used local-time getters (`getDate`, `getMonth`, `getFullYear`). Date-only strings like `"2003-05-01"` are parsed by JS as UTC midnight; in negative UTC offset timezones the local date is one day earlier. Fixed by switching to UTC getters (`getUTCDate`, etc.). Non-regression test added: `commissioning-date-no-off-by-one.spec.ts`.

Branch: `feat/issue-5-commissioning-date` — PR #8 — tagged **v0.2.0**

## 2026-05-21 — Exceptional Interventions (issue #4, PR #6)

Added support for interventions that are not bound to a task. When logging an intervention, the user can check an "Exceptional intervention" checkbox; the task selector is greyed out and a mandatory free-text label field appears in its place. An `ⓘ` icon next to the checkbox shows a tooltip explaining the distinction. Exceptional entries appear in the history with a left-border accent and do not affect task due dates.

**Backend**
- DB schema v3: recreates `interventions` table with nullable `task_id`; adds `equipment_id` (auto-populated from task for standard interventions, set directly for exceptional) and `exceptional_label` columns
- Handler validates that either `task_id` or (`equipment_id` + `exceptional_label`) is present
- `updateEquipmentHoursFromIntervention` now uses `equipment_id` directly (no task lookup needed)

**Frontend**
- `FullInterventionModal`: new checkbox + tooltip, conditional label field, updated save-disabled logic
- `HistoryPage` and `EquipmentDetailPage`: equipment filter covers both kinds; history rows show the exceptional label and a visual accent border
- New CSS classes: `.form-field--inline`, `.form-field__checkbox-label`, `.info-icon`, `.history-item--exceptional`

Branch: `feat/issue-4-exceptional-interventions` — PR #6

## 2026-05-15 — Milestone 10 Reactivity Bug Fixes (v0.1.2)

Fixed three stale-render bugs in `EquipmentDetailPage.ts` caused by static Arrow.js expressions inside `taskTabContent()` and `historyTabContent()`. Arrow.js only re-evaluates function (case-2) expressions when syncing a template; static ternaries and `array.map()` calls are initialised once and never updated. Wrapping all dynamic content in `() =>` makes Arrow track reactive state and re-render on change.

Bugs fixed:
- **Task list not refreshed after add** — empty state persisted after saving a new task
- **"Last: never" stays stale after mark done** — last intervention date never updated in the task row
- **History tab not refreshed after add** — new intervention did not appear without a page reload

Three non-regression Playwright specs added. All 12 specs pass. Tagged as **v0.1.2**.

## 2026-05-14 14:50 — Non-Regression Test Skill

Added `.opencode/skills/non-regression-test/SKILL.md` so the agent can load
a focused procedure when fixing frontend bugs. Skill contains: workflow,
spec template, locator preference order, chrome-devtools → Playwright
translation, DB state rules, gotchas, and run commands. AGENTS.md shortened
to a one-line pointer to the skill (removes duplication).

## 2026-05-14 14:30 — Playwright Non-Regression Test Harness

Set up a minimal Playwright test harness for pinning frontend bugs.

- Installed `@playwright/test` + Chromium (Ubuntu24 fallback build).
- Created `frontend/playwright.config.ts` (single chromium project, no auto-server).
- Created `frontend/tests/global-setup.ts` that wipes the DB via the REST API (deletes all equipments; cascade handles tasks + interventions). Requires both servers running.
- Created `frontend/tests/non-regression/` with `README.md` (index + conventions) and `smoke.spec.ts`.
- Added `pnpm test` and `pnpm test:ui` scripts.
- Updated `.gitignore` (test-results, playwright-report, .playwright).
- Updated `AGENTS.md`: new bullet under "When coding" requiring a Playwright spec per fixed frontend bug; "NO TESTING" replaced with non-regression guidance.
- Updated `README.md` with a short "Non-regression tests" section.
- Verified: `pnpm test` → 1 passed; `pnpm typecheck` → clean.

## 2026-05-14 — Comprehensive UX Flow Testing

Conducted a full manual test session of all documented user experience flows using Chrome DevTools and curl.

### Test Data Generated
- Created `backend/scripts/generate-test-data.sh` — a curl-based script producing equipments, tasks, and interventions
- Fixed date format in the script (RFC3339 required by backend) and task ID capture logic
- Test data: Boat Engine (hours), Home HVAC (no hours), Backup Generator (stale hours), Sailboat (added during testing)

### Test Results by Flow

#### 1. Navigation & App Shell ✅
- All 4 navbar links work (Dashboard, Equipments, History, Settings)
- Active section highlighted correctly
- URL routing matches spec for all routes
- Page titles set correctly

#### 2. Equipments List ✅
- Cards display name, description, hour-meter, last intervention, next due status
- "+ Add equipment" modal works with all fields (name, description, tracks_hours toggle)
- Empty state shows when no equipments exist
- **Bug**: Intervention dates show as "NaN-NaN-NaN" (formatting bug)

#### 3. Equipment Detail ✅
- Header shows name, hour-meter value, action buttons (Update hours, Edit, Delete)
- Tab navigation works (Tasks, History, Info)
- Tasks tab: sorted by urgency, shows name/interval/last intervention/status
- History tab: shows interventions with task name, hours, location, comments
- Info tab: shows name, description, hour-meter status, created date
- **Bug**: Page title shows "Equipment #N" instead of equipment name
- **Bug**: "Every 100h or Every 6mo" has redundant "Every"

#### 4. Add Equipment ✅
- Modal opens with all required fields
- Validation: name required
- Tracks_hours toggle shows/hides initial hours field
- Save creates equipment and refreshes list
- Cancel closes modal

#### 5. Update Hours ✅
- Pre-filled with current hours
- Min constraint set to current hours
- Update redirects back to equipment detail
- **Bug**: `hours_updated_at` is never set (remains null) — backend doesn't update it on create or update

#### 6. Edit Equipment ✅
- Form pre-filled with existing values
- Tracks_hours toggle shows confirmation when tasks have hours_interval
- Save updates and redirects

#### 7. Delete Equipment ✅
- Confirmation shows equipment name and cascade warning
- Delete removes equipment, tasks, and interventions (verified via API)
- Redirects back to equipments list

#### 8. Tasks (CRUD) ✅
- Add task: form shows name, description, interval(s); hours interval hidden when equipment doesn't track hours
- Edit task: modal pre-filled, validates at least one interval
- Delete task: confirmation modal with cascade warning
- Tasks sorted by urgency (overdue first)

#### 9. Quick Log Intervention ❌ (broken)
- Modal appears correctly with pre-filled date and hours
- **Bug**: POST fails with 400 — generated API client serializes `Date` as `"YYYY-MM-DD"` (line 93 of InterventionInputToJSON: `.substring(0,10)`) while Go backend expects RFC3339

#### 10. Global History ❌ (not implemented)
- Static stub: "No interventions recorded yet."
- No API integration, no filters, no "+ Log intervention" CTA

#### 11. Per-Equipment History Tab ⚠️ (partial)
- Shows interventions for the equipment
- **Bug**: Dates show "NaN-NaN-NaN" (formatting bug)
- Missing Edit/Delete actions on interventions

#### 12. Settings ✅
- Theme toggle works: Auto, Light, Dark
- Theme persists via localStorage
- About section shows version, repo link, license

#### 13. Dashboard ❌ (not implemented)
- Static stub: "Nothing due right now — you're all caught up."
- No data API integration, no hour-meter banner, no task grouping

### Critical Bugs Found

1. **Intervention creation broken** (frontend `InterventionInputToJSON` strips time from Date → backend rejects it)
2. **`hours_updated_at` never set** (backend `CreateEquipment` and `UpdateEquipment` don't set it)
3. **Date formatting displays NaN** (frontend `safeDate` uses `Number(date)` which fails on date strings)

### Minor Issues
- Page title shows generic "Equipment #N" instead of the actual name
- "Every 100h or Every 6mo" has redundant "Every" prefix
- Intervention rows have no Edit/Delete buttons in per-equipment History tab
- Task edit via Arrow.js reactive binding doesn't update properly (property overwrite)

## 2026-05-14 — Milestone 6 Bug Fixes

Completed all 4 items in Milestone 6:

### Critical fixes
1. **`hours_updated_at` never set** (`backend/internal/handlers/equipment.go`): `CreateEquipment` now sets
   `hours_updated_at = now` when `tracks_hours && hours != nil`. `UpdateEquipment` fetches existing
   equipment and sets `hours_updated_at = now` only when hours actually increase.
2. **Date formatting NaN** (`frontend/src/lib/format.ts` + `frontend/src/pages/EquipmentDetailPage.ts`):
   Changed `safeDate()` from `new Date(Number(date))` to `new Date(date)`. Fixed same pattern in
   `EquipmentDetailPage` history sort (`new Date(Number(a.date))` → `new Date(a.date)`).

### Minor fixes
3. **Page title** (`frontend/src/page.ts`): `routeToPage` now fetches equipment name via API for
   the equipment detail route title. Falls back to `"Equipment #N"` on failure.
4. **Redundant "Every"** (`frontend/src/pages/EquipmentDetailPage.ts`): Removed second "Every" prefix
   from months interval display. Now shows "Every 100h or 6mo" instead of "Every 100h or Every 6mo".

### Root cause investigation: Arrow.js reactive() breaks Date objects
The NaN bug had a deeper cause: Arrow.js `reactive()` wraps all nested objects in Proxies,
including Date instances. Date methods (getTime, toISOString, etc.) rely on the internal
`[[DateValue]]` slot, which is NOT forwarded by Proxy — they all throw or return NaN when
`this` is a Proxy. Fix: convert Date objects to ISO strings (`date.toISOString()`) before
storing them in reactive state. Updated all format functions to accept `Date | string | null | undefined`.

### Tests added
- `safedate-shows-nan.spec.ts` — verifies intervention dates don't show NaN after fix
- `equipment-page-title.spec.ts` — verifies equipment detail page title shows equipment name
- `interval-display-deduplication.spec.ts` — verifies no duplicate "Every" in interval text

## 2026-05-14 13:55 — Modal close bug fix

Fixed a bug where clicking any input/field inside a modal (e.g. "Mark done") caused the modal to close immediately. Root cause: the `@click` handler on `.modal-overlay` called the cancel function unconditionally, so click events bubbling up from inner elements triggered it. Applied the guard pattern already used in `EquipmentsPage.ts` to all 5 affected modals in `DashboardPage.ts` and `EquipmentDetailPage.ts`. Added Playwright non-regression spec `mark-done-modal-stays-open.spec.ts` covering both dashboard and equipment page paths. All 6 tests pass.

## 2026-05-14 — Milestone 7 Dashboard

Completed all 4 items in Milestone 7:

1. **Hour-meter freshness banner** (collapsible, stale entries highlighted with amber/red,
   "Update hours" CTA per equipment, fresh entries can be hidden)
2. **Tasks grouped by equipment**, sorted by urgency (overdue first, then due-soon;
   OK tasks hidden; equipments sorted by highest urgency)
3. **"Mark done" quick-log** from each task row (opens modal pre-filled with date and hours)
4. **Empty state**: friendly message + CTA to add equipment when no equipments exist

Commits:
- `13fa199` — Hour-meter freshness banner (collapsible, stale entries emphasized)
- `ceb14a9` — Task grouping, quick-log, empty state

## 2026-05-14 — Milestone 8 Interventions & Global History

Completed all 5 items in Milestone 8:

1. **Full intervention form**: shared `FullInterventionModal` component with equipment picker, task picker (filtered by equipment), date, hours (if applicable), location, comments. Used from both global and per-equipment history.
2. **Global history screen**: reverse-chronological list with equipment name, task name, date, hours, location, comments. Filter by equipment (dropdown) and date range (from/to date inputs).
3. **"+ Log intervention" CTA**: button in global History page header and per-equipment History tab header.
4. **Edit intervention**: pre-filled full form, save calls `updateIntervention` API.
5. **Delete intervention**: confirmation modal, equipment hours recomputed from remaining history.

Commit: `93ab3b2` — Milestone 8: Full intervention form, global history with filters, edit/delete from history

## 2026-05-15 — Milestone 13 Database Versioning

Added a `meta` key/value table to SQLite storing:
- `schema_version` (integer) — drives future schema migrations
- `app_version` (string) — last binary that opened the DB

`InitDB` now: (1) creates `meta` if missing, (2) refuses to start if the DB schema_version exceeds what the binary supports, (3) bootstraps existing pre-meta DBs as v1 by replaying the legacy ALTER TABLE list, fresh installs jump straight to v1, (4) applies numbered migrations forward-only in transactions, (5) rewrites `app_version` on every startup.

Migrations list is currently empty — v1 is the bootstrap schema. New schema changes append `{Version: N, SQL: …}` and bump `CurrentSchemaVersion`.

Spec: `doc/db-migration.md`.

## 2026-05-15 — performed_by field + dev tooling fixes

Added optional "Done by" field to interventions (person or company who performed the work).

- DB migration v2: `ALTER TABLE interventions ADD COLUMN performed_by TEXT`
- OpenAPI spec, Go model, and all DB queries updated
- Frontend: field appears between Location and Comments in the full form, and between Hours and Notes in quick log modals (Dashboard and Equipment detail); displayed in history lists when set

Also fixed two dev tooling issues:
- `make generate-openapi` was failing because `oapi-codegen` was installed in `~/go/bin` but not on PATH — Makefile now uses `$(GOBIN)/oapi-codegen`
- Vite dev server had no `/api` proxy configured — API calls were returning the HTML shell instead of hitting the backend; added `proxy: { '/api': 'http://localhost:3001' }` to `vite.config.ts`

## 2026-06-06 — Equipment documents (issue #3)

Implemented file attachments for equipments — the first slice of the `doc/file-storage.md` design (which covers #2/#3/#25/#26). Scope was kept to **#3 only**; backup-of-files (#27) and startup orphan cleanup were deliberately deferred.

Backend:
- Migration **v5**: `equipment_files (equipment_id, file_path PK, original_name, uploaded_at)`; `CurrentSchemaVersion` → 5
- New `internal/filestore` package: derives the `files/` dir from `database.path`, creates it on startup, and resolves relative ↔ absolute paths
- Files stored on disk at `files/equipments/{id}/files/{random}.{ext}`; DB holds only the relative path. Size cap 25 MB, enforced from header **and** while streaming
- Handlers: `ListEquipmentFiles`, `UploadEquipmentFile`, `GetEquipmentFile` (served `attachment` with original filename + sniffed MIME), `DeleteEquipmentFile`
- Cascade: deleting an equipment removes its `equipment_files` rows and the whole `files/equipments/{id}/` tree; deleting a document removes its row and disk file
- Tests in `tests/equipment_file_test.go` cover upload→list→download→delete, missing-equipment 404, and equipment-delete cascade

Frontend:
- New **Documents** tab on the equipment detail screen (between History and Info); router regex updated
- Upload via hidden file input, list with size + date, download link, delete confirmation modal
- `formatFileSize` helper added to `lib/format.ts`

API spec: 4 new operations + `File` schema in `backend/api/openapi.yaml`; Go and TS clients regenerated.

> Note: pre-existing `pnpm run typecheck` errors in `DashboardPage.ts` and `EquipmentsPage.ts` are unrelated to this work (the required gate is `pnpm run build`, which passes).

## 2026-06-06 — Dismiss "Keep your hour-meters fresh" reminder with same value (issue #16)

The freshness reminder could not be dismissed when an equipment simply had not run: `hours_updated_at` was bumped only when the new value was *strictly greater* than the current one, so saving the same value (or doing nothing) left the row stale forever.

Spec-first (doc/ updated and approved before code):
- `doc/data-model.md`: explicit hour-meter updates now refresh `hours_updated_at` even when the value is unchanged (value must be ≥ current); intervention logging keeps the stricter "only when hours increase" rule.
- `doc/gui/dashboard.md`: documented the new **"Same hours"** banner button + dismissal flow.
- `doc/gui/equipments.md`: updated the Update hour-meter flow.

Backend:
- New dedicated endpoint **`PUT /equipments/{id}/hours`** (`EquipmentHoursInput { hours }`) — sets hours (rejects values below current with 400, non-tracking equipment with 400) and **always** refreshes `hours_updated_at` to now. Kept separate from `updateEquipment` so editing name/description never touches freshness.
- `tests/equipment_hours_test.go`: same-value refresh, higher accepted, lower rejected (400), non-tracking (400), not-found (404).

Frontend:
- Dashboard banner: new **"Same hours"** ghost button per row → calls the endpoint with the current value and reloads, dropping the row out of the stale list.
- "Update hours" form now posts to the dedicated endpoint, so saving the same value also dismisses the reminder.
- Added `.btn--ghost` style.

> Note: the same pre-existing `pnpm run typecheck` errors persist (unrelated; gate is `pnpm run build`, which passes). Follow-up issues filed to wire typecheck and Playwright into CI.

## 2026-06-06 — Equipment picture & icon (issue #2)

Added a visual identity to equipments: an uploadable profile picture with a customizable emoji icon fallback (default 🔧). Reused the `filestore` package, image MIME-sniff + size-cap upload logic, `detectMime`, and the `FileInfo` shape from #3/#25.

Backend:
- Migration **v7**: `equipments.picture TEXT` + `equipments.icon TEXT NOT NULL DEFAULT '🔧'`; `CurrentSchemaVersion` → 7
- New handlers in `internal/handlers/equipment_picture.go`: upload/replace (image-only, 10 MB cap, 415/413 before write), serve inline, delete. One picture per equipment at the fixed path `files/equipments/{id}/picture.{ext}`; replacing with a different extension removes the old file
- `picture` stored as a relative path in the `equipment.picture` column (no `*_files` table); `UpdateEquipment` deliberately leaves `picture` untouched (managed only by the picture endpoints). New `db.UpdateEquipmentPicture`
- `icon` added to the Equipment model + create/update; defaults to 🔧 when empty (including legacy NULL rows via `iconOrDefault`)
- Equipment-delete cascade already removes the whole `files/equipments/{id}/` tree, so the picture goes with it
- Tests in `tests/equipment_picture_test.go`: upload→serve→replace→delete, 415 non-image, 404 missing equipment / no picture, equipment-delete cascade, icon default/update/clear

API spec: 3 new picture operations + `picture`/`icon` on `Equipment` and `icon` on `EquipmentInput`; Go and TS clients regenerated.

Frontend:
- New reusable `components/EquipmentAvatar.ts` (picture-or-emoji, `sm`/`lg` sizes, cache-bust token)
- Equipment detail header: editable avatar (tap to upload/replace) + "Remove picture" action + upload error flash; `mapEquipment` helper extracted and `reloadEquipment` added
- Icon emoji field in the create (EquipmentsPage) and edit (EquipmentEditPage) forms; read-only icon row in the Info tab
- Avatar shown on the equipments list cards and the dashboard equipment blocks; CSS for `.equipment-avatar*`, `.equipment-card__head`, `.emoji-input`, `.form-field__hint`

> Note: the same two pre-existing `pnpm run typecheck` errors remain (verified present on `main`); the `pnpm run build` gate passes. Verified end-to-end with curl (create with icon, upload/serve/reject/delete picture).

## 2026-06-07 — Issue #2 scope reduced to icon-only; emoji picker

Iterated on the feature during review. **The equipment picture was dropped entirely** — only the emoji `icon` remains.

- **Picture removed**: deleted the `picture` column from migration v7 (now adds only `icon`), the `equipment_picture.go` handler, `db.UpdateEquipmentPicture`, `filestore.EquipmentPictureRelPath`, the model field, and the 3 `/equipments/{id}/picture` API operations + `picture` schema field. Go/TS clients regenerated. Picture tests replaced by `tests/equipment_icon_test.go`.
- **Icon is mandatory** (default 🔧) and shown wherever an equipment is referenced — list cards and dashboard (`EquipmentAvatar`, now emoji-only). Not shown on the detail page (per the agreed display rule at the time).
- **Emoji picker**: replaced the plain icon text field with `components/IconPicker.ts` — a button opens the `emoji-picker-element` web component (searchable, categorized) in a popover, with a Reset to 🔧. There is no programmatic way to open the OS emoji picker from the web, hence an in-app picker. Emoji data is **bundled locally** (`emoji-picker-element-data`, emitted as a same-origin asset) so it works offline (self-hosted/boat scenario).
- New runtime deps: `emoji-picker-element`, `emoji-picker-element-data` (a deliberate, approved break from the zero-deps posture).

Docs updated: `data-model.md`, `file-storage.md`, `gui/equipments.md`, `README.md`, `ROADMAP.md` (Milestone 16 → "Equipment Icon"). `make build` and `go test ./tests/` pass; only the 2 pre-existing typecheck errors remain.

Follow-up: the icon is now also shown on the **equipment detail page** header, left of the name, as a clickable avatar — clicking it opens the same emoji picker (`iconPicker` gained an `avatar` variant) and the change is persisted immediately via `updateEquipment` (optimistic update, reverts on failure). `data-model.md` / `gui/equipments.md` updated accordingly.

## 2026-06-07 — Release v0.4.0

Tagged and pushed `v0.4.0`. CI triggered the release pipeline, which builds Linux and Windows binaries and publishes the GitHub release with auto-generated notes.

Changes bundled in this release (since v0.3.0):
- **Equipment icon** (issue #2): emoji picker on create/edit forms and equipment detail header; icon shown on list cards and dashboard
- **Equipment document attachments** (issue #3): upload, serve, delete documents attached to equipments
- **Intervention photo attachments** (issue #25): upload, serve, delete photos attached to interventions
- **"Same hours" dismissal** (issue #16): ghost button per stale row + dedicated `PUT /equipments/{id}/hours` endpoint that refreshes `hours_updated_at` even when the value is unchanged
- **Version update notification** (issue #11): backend polls GitHub releases; frontend banner when a new version is available

## 2026-06-08 — Mobile fixes & equipment status aggregation (issues #34, #36, #37, #38)

Four fixes and features merged since v0.4.0:

- **Freshness reminder dismiss** (issue #34): clicking "Same hours" on the dashboard now hides the row immediately without waiting for a page reload. Non-regression Playwright test added.
- **Task layout mobile** (issue #36): task cards no longer overflow on small screens; layout and spacing adjusted.
- **Equipment tab bar mobile** (issue #37): the tab bar on the equipment detail page now scrolls horizontally on mobile instead of wrapping.
- **Equipment status aggregation** (issue #38): the Equipments page now shows an aggregated status badge per equipment (OK / Warning / Overdue) derived from its tasks' next due dates. Includes a follow-up refactor pass addressing code-review findings (reactive state, ISO string conversion for dates).

## 2026-06-09 — Dev-cycle tooling: demo seeder + run-skill fixes

Reduced friction in the PR-review loop (no GitHub issue — developer tooling).

- **Demo data seeder** (`backend/cmd/seed/main.go`, `make seed`): populates a *running* backend via the REST API (not raw SQL, so it survives schema migrations). 3 equipments (hour-tracked engine + two time-based), 8 tasks, 13 interventions including one exceptional. All dates are computed relative to "now", so the Dashboard always shows a deliberate Overdue / Due-soon / OK spread regardless of when it runs. Probes `/api/version` for readiness. Verified end-to-end against a live backend.
- **`run-openmaintenance` skill fixes**: (1) start the backend as a Claude-tracked `run_in_background` task instead of a shell `&`, so logs stay visible via `BashOutput`; (2) seed + print the LAN URL (`hostname -I`) so the app opens on a phone on the same network; (3) corrected the readiness probe — the skill referenced a non-existent `/api/health`; it's now `/api/version`.
- README: added `make seed` under Development.

Note: ROADMAP not touched — this is dev tooling, not product scope.

## 2026-10-03 — Agent-skill config & architecture review (issues #65–#75)

No product code changed this session.

- **Agent-skill config** (`2df26a8`): added an `## Agent skills` block to `AGENTS.md` and `doc/agents/` (`issue-tracker.md` → GitHub, `triage-labels.md` → default labels, `domain.md` → single-context, ADRs in `doc/adr/`). Created the `ready-for-agent` and `needs-info` labels on GitHub.
- **Architecture review** (hot spots from the last 80 commits): six deepening candidates found; the four Strong ones were broken into tickets. Each refactor ticket absorbs the bugs found in its area, with a non-regression test landing first (bug-fix workflow).
  - Due status: #66 fixed-clock tests → #67 report the driving trigger → #68 one urgency ranking
  - Hour-meter: #69 one module owns every reading change → #70 delete/edit recompute rule (**needs-info**: decision pending)
  - Calendar dates: #65 Vitest → #71 one frontend calendar-date module → #72 plain dates in API and storage
  - Intervention logging: #73 the form owns its logic → #74 quick log uses it
  - Standalone bug: #75 moving an intervention to another equipment's task loses its photos
- Bugs reproduced against a running backend: metadata edit resets hour-meter freshness and can lower the reading (#69); deleting an intervention leaves hours unchanged (#70); intervention dates show a day early in UTC+ timezones (#71); photos lost on move (#75). Found by inspection: the Equipments page timing and ranking (#67, #68), Dashboard quick log missing the #51 fixes (#71, #74), and the History edit form losing its equipment (#73).
- Not ticketed (Worth exploring): pulling data loading out of the pages; moving the file-upload code into the attachment module.

Can start now: #65, #66, #69, #75.

## 2026-10-14 — Bug triage & Windows build fix (issue #86)

- **Triage**: reviewed the 10 open bugs and ranked them: #86, #92, #81, #80, #70, #58, #73, #74, #85, #83. #81, #70 and #85 still need a decision before they can be built; #58 may be fixed by #74.
- **Windows build fix** (issue #86, PR #93): the `.exe` was cross-compiled on Linux without a Windows C compiler, so Go turned cgo off and `mattn/go-sqlite3` compiled to a stub that refuses to open the database. A user confirmed the crash on Windows 11 with v0.6.0.
  - The Windows target now builds with `CGO_ENABLED=1 CC=x86_64-w64-mingw32-gcc`; CI installs `gcc-mingw-w64-x86-64`. The Linux target sets `CGO_ENABLED=1` explicitly.
  - New `make check-cgo BIN=<binary>` runs after each CI backend build. It failed on the Windows build before the fix (red CI run on the first commit) and passes after it.
  - Verified under Wine: the `.exe` starts, creates `maintenance.db` and serves the API. Not yet run on real Windows.
  - `CONTRIBUTING.md` lists `gcc` and MinGW-w64 as prerequisites.

## 2026-10-14 — Intervention photos on a missing intervention (issue #92)

- **Bug**: `resolveIntervention` returned `ctx.JSON(404, …)` as its error. That is `nil` once the response is written, so the photo endpoints kept going: an upload to a missing intervention wrote the file under `files/equipments/0/` plus an `intervention_files` row (inherited by whichever intervention later got that id), and every endpoint appended a second response to the 404.
- **Tests first** (`backend/tests/intervention_file_test.go`, written with the TDD skill at the HTTP API seam): a rejected upload leaves no file on disk and no photo on the intervention that later gets the id; upload, list, serve and delete answer the 404 alone.
- **Fix**: `resolveIntervention` now returns `ok bool`; callers return as soon as it is false.
- Verified with `make test-backend`, `go vet`, gofmt, and curl against a running backend. `make build` not run end to end here (no `pnpm` on this machine; the frontend is untouched).

## 2026-10-14 — Hours baseline without a reading (issue #81)

- **Bug**: the hours baseline was the latest intervention's `hours_at`, falling back to `0`. Marking an hours-based task done without a reading made it overdue at once (1 500 h meter, 100 h interval: 1 500 ≥ 0 + 100).
- **Decision (option A, variant A2)**: the baseline is the most recent intervention on the task that has a reading. Never performed: `0`. Performed but never with a reading: no hours baseline, so the hours rule gives no `next_due_hours`, status, amount or urgency (months decides, or OK). Spec: `doc/data-model.md` "Hours baseline".
- **Refactor first** (no behaviour change): `logic.ComputeDueStatus` takes the task's interventions instead of only the latest, so the rule lives in one place; the now-unused `db.GetLastInterventionByTask` is gone.
- **Tests first** (TDD skill, two agreed seams): the three "Current behaviour" cases pinned by #66 in `due_status_rules_test.go` became the new rule plus "latest reading" cases; one `httptest` case in `backend/tests/task_due_status_test.go` (reading 1 450 then a reading-less log → `next_due_hours` 1 550, OK).
- **Review follow-up**: `enrichTask` discarded the error loading the task's interventions, so a DB failure counted from 0 and could show the task overdue. It now logs the error and leaves the due fields out (test first, `httptest`).
- Verified with `make test-backend`, `go vet`, gofmt, and curl against a running build. Frontend untouched (it already ignores a null `due_in_hours`); `make build` not run end to end (no `pnpm` here).

## 2026-10-15 — Next due date past the end of the month (issue #80)

- **Bug**: the next due date used Go's `AddDate(0, months, 0)`, which rolls an overflowing day into the next month: Jan 31 + 1 month gave Mar 3, Aug 31 + 6 months Mar 3, Feb 29 + 12 months Mar 1. Tasks done at a month's end were announced a few days late.
- **Decision**: clamp to the target month's last day (Jan 31 + 1 month = Feb 28, Feb 29 in a leap year). Spec: `doc/data-model.md` "Date baseline precedence".
- **Test first**: the five "Current behaviour" month-end cases pinned by #66 in `due_status_rules_test.go` now expect the clamped dates.
- **Fix**: `addMonths` helper in `logic/due_status.go`; no other code does month arithmetic (the frontend shows the backend's date).
- Verified with `make test-backend`, `go vet`, gofmt, and curl against a running build (task done Jan 31, monthly → `next_due_date` 2026-02-28). Frontend untouched.

## 2026-10-19 — Intervention form module (issue #73)

- **Triage**: #58 closed as a duplicate of #97 (quick log has no Location field). The spec change for #97 is approved and recorded on the issue; it waits for #74 so the field is added once, in the shared module.
- **Bug absorbed**: editing an intervention from the global History opened the form with no equipment: empty Task list, no Hours field, and Save disabled for an exceptional intervention.
- **Test first**: `frontend/tests/non-regression/history-edit-keeps-equipment.spec.ts` (Playwright), red on the old pages.
- **Module** (TDD skill, seams agreed: prefill, validation, request building, plus the Playwright spec): `src/lib/interventionForm.ts` with `prefill`, `selectEquipment`, `canSave`, `toRequest` and `save`, covered by `interventionForm.test.ts` in every test timezone. `FullInterventionModal` owns its state and saves through it; Equipment detail and History only open it for `{ new }` or `{ edit }`.
- **One hour-reading rule**: the reading is sent whenever the equipment tracks hours, `0` included (History used to send it only above 0). Picking an equipment prefills its current reading. Spec: `doc/gui/interventions.md`.
- Also fixed on the way: the edit form's Task select showed no selection, because `.value` was set before its options rendered; options now carry `selected`.
- **Review follow-ups on PR #98**: an edit of an intervention logged without a reading no longer saves `0 h` (which would have become the task's hours baseline after #81); the form's reading is `number | null`. The form is now built when opened, outside the page's reactive expression, so the page's data arriving while it is open (a slow first load of History) no longer rebuilds it and wipes what was typed. Each landed test first: `interventionForm.test.ts` cases, `intervention-form-keeps-input-on-data-load.spec.ts`.
- **Tooling on this machine**: pnpm 10.14.0, Chromium and its system libraries, and a headless JRE (for `pnpm run generate:api`) are now installed, so the full frontend workflow runs locally.
- Verified with `pnpm test:unit`, `pnpm test` (41 Playwright specs), `pnpm run typecheck` and `pnpm run build`.

## 2026-10-19 — Quick log uses the intervention form module (issue #74)

- Stacked on PR #98 (#73), branch `refactor/issue-74-quick-log-module`.
- **Bug absorbed**: a refused Dashboard quick log showed "Failed to save intervention" instead of the backend's reason (the #51 fix had reached Equipment detail and History only).
- **Test first**: `frontend/tests/non-regression/dashboard-quick-log-error-shows-reason.spec.ts` (Playwright, a future date refused by the backend), red on the old Dashboard.
- **Module** (TDD skill, seams agreed: quick-log prefill and request in `interventionForm.test.ts`, plus the Playwright spec): a new `{ quickLog: { taskId } }` source fixes the task and takes its equipment, today's date and the equipment's current reading (none when it does not track hours).
- **One quick log**: `src/components/QuickLogModal.ts` prefills, validates and saves through the module; the Dashboard and Equipment detail build it when "Done" is clicked and only toggle it. On the Dashboard it now sits outside the page's reactive content, so a data reload cannot rebuild it.
- **Behaviour change**: an emptied Hours field in the quick log sends no reading (it used to send `0`). Spec: `doc/gui/interventions.md`.
- #97 (Location in the quick log) can now add the field once, in `QuickLogModal`.
- Verified with `pnpm test:unit`, `pnpm test` (42 Playwright specs), `pnpm run typecheck`, `pnpm run build` and `make build`.
- **Follow-up fix**: an equipment that tracks hours but has no reading yet no longer gets an invented reading of `0` in a new log, a quick log or after picking the equipment (saving untouched used to set the meter to 0, mark it fresh and hide the Dashboard reminder). The Hours field stays empty until the user fills it. Failing Vitest cases first (`interventionForm.test.ts`), then the fix in `startingReading`. Showing such an equipment as incomplete is #103.

## 2026-10-19 — Expiry tasks (issue #99)

- Stacked on PR #100 (#74), itself on PR #98 (#73); branch `feat/issue-99-expiry-tasks`.
- **Spec first** (decisions from the issue's grilling session, approved): the repo's first root `CONTEXT.md` (Expiry task, Interval task, Expiry date, Current expiry date), `doc/data-model.md` (Task kinds, Expiry rule, expiry urgency), `doc/gui/tasks.md`, `interventions.md`, `dashboard.md`, and ADR `doc/adr/0001-expiry-task-kind.md` (a separate kind, fixed at creation).
- **API**: `Task.kind` (`interval` | `expiry`, default `interval`; another kind on update is a 400, none keeps it), `Task.current_expiry_date` and `Intervention.expiry_date` (`format: date`); `due_trigger` gains `expiry`. Schema v8 adds the three columns; existing tasks become interval tasks.
- **Due status**: the latest intervention's expiry date, else the current expiry date, else overdue with no date. Due soon 30 days before, overdue from the date itself (as the months rule). Urgency (today − fitted) ÷ (expiry − fitted); none with only a current expiry date; the largest double for a part fitted already expired, so it tops the overdue tasks.
- **Tests first** (TDD skill, agreed seams): table-driven `due_status_expiry_test.go` and ranking cases in `urgency_rank_test.go`; `httptest` contract tests in `backend/tests/expiry_task_test.go`; `interventionForm.test.ts` cases for the expiry date in the full form and the quick log; one Playwright happy path, `expiry-task-happy-path.spec.ts`.
- **Frontend**: the quick log, full form and edit form show a required Expiry date for expiry tasks; the task form picks the kind on create, shows it as text on edit, and asks for the current expiry date only while the task has no intervention. Timing text: "Expires in N days", "Expires today", "Expired N days ago", "no expiry date"; trigger summary "On expiry date".
- Verified with `go test ./...`, `go build`, `pnpm test:unit`, `pnpm test`, `pnpm run typecheck`, `pnpm run build` and `make build`.
- **Follow-ups** (after review): merged PR #100's no-reading fix. Logging a replacement (or editing an intervention onto an expiry task) now clears the task's current expiry date in the same transaction, so deleting every intervention leaves the task overdue with no date and the task form asks for the date again (user decision; showing it as incomplete is #103). Spec in `doc/data-model.md` and `doc/gui/tasks.md`, failing `httptest` cases first in `expiry_task_test.go`, then the fix in `internal/db/intervention.go`. The quick log and full form share one `expiryDateField` (`src/components/ExpiryDateField.ts`); `DueStatus` comments now cover the expiry rule.
- **More tests** (all passing at once): `httptest` cases for moving an intervention between task kinds and updating a missing task (404) in `expiry_task_test.go`; the repo's first migration test, `internal/db/migrations_test.go`, opens a schema v7 database and checks an existing task migrates to an interval task with no current expiry date and its intervention with no expiry date.

## 2026-10-19 — Location in the quick log (issue #97)

- Branch `fix/issue-97-quick-log-location`.
- **Spec first** (approved on the issue): `doc/gui/interventions.md` Quick log gets an optional Location between Hours and Done by; the "not asked in quick mode" line goes.
- **Test first**: `frontend/tests/non-regression/quick-log-asks-for-location.spec.ts` (Playwright, Dashboard "Done": labels in order Date, Hours, Location, Done by, Notes; the saved intervention carries the trimmed location), red on the old modal. No new Vitest case: `interventionForm.test.ts` already covers the trimmed location and a blank one omitted from a quick log.
- **Fix**: `QuickLogModal` renders the Location field; the module already sent it.
- Verified with `pnpm test:unit`, `pnpm run typecheck`, `pnpm run build`, `pnpm test` (44 Playwright specs) and `make build`.

## 2026-10-19 — Reject a negative hour reading (issue #102)

- Branch `fix/issue-102-reject-negative-hours`. Spec in `doc/data-model.md` ("A reading is never negative"), `minimum: 0` in `openapi.yaml`.
- **Tests first**: `backend/tests/negative_hours_test.go` (`httptest`), red on `main` for every path: log (standard and exceptional) and edit an intervention, create an equipment, turn the hour-meter on, "Update hours". Each asserts a 400 whose reason says the reading cannot be negative, and that nothing was stored.
- **Fix**: `hourmeter.CheckReading` / `ErrNegative`, used by every explicit reading and by `validateIntervention` for `hours_at`; equipment creation checks before the row is written.
- The intervention forms already show the backend's reason (`save()` in `interventionForm.ts`). The equipment create form and "Update hours" page still show a generic error message.
- Verified with `go test ./...`, `go build`, `pnpm test:unit`, `pnpm run build` and `make build`.
- **Follow-ups** (after review): the reason is exactly "Hours cannot be negative" on every path (no `hours_at:` prefix); equipment create and edit also refuse a negative `hours` they would ignore (no hour-meter, or an edit that does not turn it on). The equipment create modal and "Update hours" now show the backend's reason (`extractErrorMessage`); "Update hours" rendered its error flash statically, so it showed no error at all before. The equipment edit form already showed the reason. Tests first: new `httptest` cases in `negative_hours_test.go` and `frontend/tests/non-regression/equipment-hours-error-shows-reason.spec.ts` ("Update hours" cannot send a negative value from the UI, so it is pinned with a reading raised elsewhere while the page is open). Existing negative data is left as is. Verified with `go test ./...`, `pnpm test:unit`, `pnpm run build`, `pnpm test` (46 specs) and `make build`.

## 2026-10-19 — Never lower the hour-meter reading silently (issue #70)

- Branch `fix/issue-70-never-lower-reading-silently`; decisions from the issue's agent brief (maintainer grilling session).
- **Spec first**: `doc/data-model.md` ("What changes the reading", new "Reading in doubt" and "Correct reading"), `doc/gui/interventions.md` (delete copy, the question), `doc/gui/equipments.md` ("Correct reading" flow and header action), `doc/gui/history.md`; `openapi.yaml` adds `PUT /equipments/{id}/hours/correction`.
- **Design choice**: the frontend detects the doubt (`src/lib/readingDoubt.ts`), from the equipment and interventions the page already holds; the delete and edit endpoints are unchanged. The backend only gains the correction path (`hourmeter.Correct`, the one path allowed to lower).
- **Tests first** (TDD, agreed seams): `httptest` in `backend/tests/hourmeter_test.go` (delete keeps the reading; correction lowers, refreshes freshness, refuses negative / non-tracking / unknown); Vitest `readingDoubt.test.ts`; Playwright `delete-intervention-asks-about-reading.spec.ts`.
- **Frontend**: after a delete or an edit that leaves the reading in doubt, `ReadingDoubtModal` asks Keep (default, focused) or Correct; "Correct reading" page at `/equipments/{id}/edit/hours/correct?hours=`, also linked from the equipment header.
- **Follow-ups** (maintainer review, after merging #105): `hourmeter.Correct` uses #102's `CheckReading`, so a negative correction gets the same 400 and "Hours cannot be negative". No question when another intervention left on the equipment still recorded the current reading (rule changed in `doc/data-model.md`, "Reading in doubt"). Stale page guard: the question is asked only if the reloaded reading still equals the one in doubt (`stillInDoubt`). The question plumbing is shared (`readingQuestion()` in `ReadingDoubtModal.ts`). Tests first: Vitest cases in `readingDoubt.test.ts`, red before each fix; Playwright `edit-intervention-asks-about-reading.spec.ts` (edit 500 h down to 450 h asks, Correct prefilled with 450, on both pages) pins existing behaviour.

## 2026-10-30 — Done opens the full intervention form, prefilled (issue #107)

- Branch `feat/issue-107-done-opens-full-form`; decision and acceptance criteria from the issue.
- **Spec first**: `doc/gui/interventions.md` drops the "Quick log" entry mode. Done opens the one intervention form prefilled: the row's equipment and task, today, the current reading or empty, and an expiry date that is empty and required. The flow and the layout sketch are updated, and so are `dashboard.md`, `tasks.md`, `equipments.md` and a line in `data-model.md`.
- **Tests first** (TDD, agreed seams): Vitest `interventionForm.test.ts` quick-log cases now use the `done` source (red: unknown source). Playwright `done-opens-full-form-prefilled.spec.ts` covers the Dashboard (equipment, task, today and hours prefilled; location saved; row leaves) and Equipment detail (no picker, no reading invented, list refreshes). It replaces `quick-log-asks-for-location.spec.ts`. `dashboard-done-error-shows-reason.spec.ts` and `dashboard-done-defaults-to-local-date.spec.ts` are the renamed quick-log specs, and `mark-done-modal-stays-open.spec.ts` was moved to the full form. All were red before the change.
- **Implementation**: `FullInterventionModal` opens with `{ done: { taskId } }` from both pages. `QuickLogModal` and the `quickLog` source are removed. A new log leaves no reading in doubt, so the #106 question still comes only after an edit.
- **Surprise, fixed separately (issue #109)**: the Dashboard did not drop a task marked done while another equipment still had a due task (also on `main` with the quick log). The due list's blocks and rows were static arrays inside a reactive slot (Arrow.js Gotcha 9). Test first: `dashboard-refreshes-with-other-due-tasks.spec.ts`, red, then the fix in `DashboardPage.ts`.
- Verified with `go test ./...`, `pnpm test:unit`, `pnpm run typecheck`, `pnpm run build`, `pnpm test` (53 specs) and `make build`.

## 2026-11-18 — Equipment groups (issue #112)

- Branch `feat/issue-112-equipment-groups`; decisions from the issue's grilling session.
- **Spec first** (approved): `doc/data-model.md` (Group, "Group membership"), `doc/gui/equipments.md` (sections, section header, the Group picker, "Manage a group"), `doc/gui/history.md` (group filter). ADR 0002 records every decision of the issue; `CONTEXT.md` gains **Group**. Decisions added on approval: default icon 🗂️; an equipment edit replaces `group_id` (absent = no group), so the detail-header icon picker sends it back; ties sort a group before a same-named equipment; "+ New group" creates the group at once.
- **Tests first** (TDD, agreed seams): migration test `TestMigrateV8_ExistingEquipmentHasNoGroup`; `httptest` contract in `backend/tests/groups_test.go` (create, name rules on create and rename, `group_id` on equipments, delete ungroups); Vitest `src/lib/equipmentGroups.test.ts` (list order, card and header status, History filter); Playwright `equipment-groups.spec.ts`. Each slice was red first.
- **Backend**: migration v9 (`groups`, `equipments.group_id`); `internal/db/group.go`, `internal/handlers/group.go`; equipment create/edit refuse an unknown group before storing anything. Deleting a group nulls `group_id` in the same transaction. The seed adds a "Winches" group.
- **Frontend**: `src/lib/equipmentGroups.ts` holds the rules; `GroupPicker` component; the Equipments list renders sections as panels with a ⋯ menu; `IconPicker` takes a default icon and a menu-item variant; the History filter has Groups / Equipments headings (equipment option values unchanged).
- **Surprise, fixed with its test**: after "+ New group" and a cancelled form, the list re-rendered without a reload and duplicated cards: Arrow matched the list blocks by position and kept their static content (Arrow.js Gotcha 9). The blocks are now keyed by render generation. Test first: the "form cancelled" case in `equipment-groups.spec.ts`, red without the keys.
- The Playwright global setup now also deletes groups (an equipment delete leaves them).
- Checked in the browser (Chrome DevTools MCP): sections, collapse, rename, change icon, duplicate name, "+ New group" then cancel, History filter, phone width; no console errors.
- Verified with `go test ./...`, `pnpm test:unit`, `pnpm run typecheck`, `pnpm run build`, `pnpm test` (58 specs: 56 pass; `dashboard-refreshes-with-other-due-tasks` and `done-opens-full-form-prefilled` fail on dates where a month ahead is 30 days or less, unrelated to this branch) and `make build`.

## 2026-11-18 — Decommissioned equipment (issue #113)

- Branch `feat/issue-113-decommission-equipment`; decisions from the issue's grilling session, all recorded in ADR 0003 (with the alternatives rejected); `CONTEXT.md` gains **Decommissioned equipment**.
- **Spec first** (approved): `doc/data-model.md` (`decommissioned_at`, "Decommissioning" with its date rules, "Decommissioned equipment: never due", ranking), `doc/gui/equipments.md` (Show decommissioned, dimmed card, section count and message, header badge, Info tab, "Flow: Decommission an equipment"), `dashboard.md`, `history.md`, `interventions.md`, `tasks.md`. Decisions added on approval: the date is edited in the edit form (the Info tab is read-only) and not offered by the create form; Show decommissioned is remembered per browser; a task of a decommissioned equipment has none of the computed due fields; an edit without the date puts the equipment back in service, so the detail-header icon picker sends it back; "in the future" means after today in UTC+14, so the API never refuses the user's today.
- **Tests first** (TDD, agreed seams), each slice red first: Go logic `TestComputeDueStatusDecommissionedEquipment`; `httptest` `backend/tests/decommissioned_equipment_test.go` (round trip on every endpoint, back in service, date rules on edit and create); Vitest `equipmentGroups.test.ts` (hidden / shown, card and section status), `hourMeterFreshness.test.ts`, `interventionForm.test.ts` (picker order and labels), `decommissioning.test.ts` (labels, edit-form date rule); Playwright `decommissioned-equipment.spec.ts`.
- **Backend**: migration v10 (`equipments.decommissioned_at`); `ComputeDueStatus` returns no status for a decommissioned equipment; equipment create/edit check the date before storing anything.
- **Frontend**: `src/lib/decommissioning.ts` and `src/lib/hourMeterFreshness.ts` hold the rules. `equipmentList` takes `showDecommissioned` and counts the hidden ones per section. `equipmentStatus` gives no badge when no task has a due status: it used to say OK, and the Tasks tab defaulted a missing status to OK too. The seed adds a decommissioned outboard.
- **Specs touched**: `date-shifts-back-east-of-utc` and the two `confirm-tracks-modal-*` specs found "the" date input of the edit page, which now has two; they use the commissioning date's label.
- Checked in the browser (Chrome DevTools MCP, built binary on a scratch DB): hidden by default, Show decommissioned (dimmed card in its group, muted badge and date), header badge, Info tab, Tasks tab without indicator, edit form, phone width.
- Verified with `go test ./...`, `pnpm test:unit`, `pnpm run typecheck`, `pnpm run build`, `pnpm test` (59 specs: 57 pass; `dashboard-refreshes-with-other-due-tasks` and `done-opens-full-form-prefilled` still fail on dates where a month ahead is 30 days or less, also without this branch's changes) and `make build`.

## 2026-11-18 — Calendar-proof Dashboard Done specs (issue #116)

- Branch `fix/issue-116-calendar-proof-done-specs`. Not a product bug: by the 30-day due-soon margin, a monthly task done today is due soon at once whenever next month's date is 30 days away or less, so `dashboard-refreshes-with-other-due-tasks` and the Dashboard test of `done-opens-full-form-prefilled` failed in February, April, June, September and November.
- **Red**: the existing specs on `main` (CI run 44442860459, and locally today: both `toHaveCount(0)` received 1).
- **Fix (tests only)**: the task marked Done is yearly (`months_interval: 12`), through a parameter on each spec's helper: overdue before Done from its old intervention, OK right after in any month. The monthly due-soon task and the Equipment detail test are unchanged.
- Verified with `pnpm test` (59 specs, all pass), `pnpm test:unit`, `pnpm run typecheck` and `pnpm run build`.

## 2026-11-19 — Release v0.8.0

Tagged `v0.8.0` on `main` (4125b2d) and pushed the tag. The release pipeline (run 44451097736) passed every job, built the Linux and Windows binaries, and published the [GitHub release](https://github.com/vtellier/OpenMaintenance/releases/tag/v0.8.0) with auto-generated notes.

Changes bundled in this release (since v0.7.0):
- **Expiry tasks** (issue #99): a part is due on the expiry date printed on it.
- **Never lower the hour-meter reading silently** (issue #70): after a delete or an edit, the app asks whether to keep the reading; **Correct reading** added. Negative readings are refused (issue #102).
- **Done opens the full intervention form, prefilled** (issue #107), replacing the quick log; the Dashboard drops a task marked done while other due tasks remain (issue #109).
- **Equipment groups** (issue #112): sections on the Equipments list, a Group picker, and a History group filter.
- **Decommissioned equipment** (issue #113): it keeps its history, its tasks are never due, and it is hidden from the Equipments list unless "Show decommissioned" is checked.
- Intervention form refactors (issues #73, #74), an optional Location on Done (issue #97), the Windows build with cgo (issue #86), and calendar-proof Dashboard Done specs (issue #116).

The database schema goes from version 7 to 10 (migrations are forward-only): once v0.8.0 has opened a database, older binaries refuse it.

CI note: `build-frontend` downloads the OpenAPI generator JAR from Maven Central on every run, and the PR #117 run was refused twice ("Your ip has exceeded rate limits", HTTP 429) before a re-run passed.

## 2026-11-24 — Larger equipment documents, and the upload error says why (issue #119)

- Branch `fix/issue-119-large-document-upload`. A 28.7 MiB Victron manual was refused with a generic "Failed to upload document": documents were capped at 25 MB, and the Documents tab dropped the server's 413 reason.
- **Reproduced** with `curl` against a backend built into the scratchpad (its own DB): `413 {"error":"file exceeds the 25 MB limit"}`, nothing stored.
- **Spec first** (approved): `doc/file-storage.md` (documents 50 MB; the `error` text states the limit broken, built from the cap) and `doc/gui/equipments.md` (Documents tab: 50 MB, a refused upload shows the server's reason).
- **Tests first** (TDD, agreed seams), each slice red first: `httptest` `TestEquipmentFile_UploadsALargeManual` (40 MB → 201, listed) and `TestEquipmentFile_RefusesADocumentOver50MB` (51 MB → 413 "file exceeds the 50 MB limit", nothing listed); Playwright `equipment-upload-error-shows-reason.spec.ts`, with the upload POST stubbed to a 413 so no tens of MB go through the browser.
- **Fix**: `filestore.MaxDocumentSize` 50 MB; both 413s in `equipment_file.go` use a message built from it; the OpenAPI description says 50 MB (generated code unchanged); `onUploadChange` uses `extractErrorMessage`. Photos stay at 10 MB, and their 413 text is still a literal.
- Playwright ran against the scratchpad backend (reused by `webServer`), so the global setup's wipe never touched `backend/maintenance.db`.
- Verified with `go test ./...`, `pnpm test:unit`, `pnpm test` (60 specs, all pass), `make build`, and `curl` on the fixed backend (the 30,067,499-byte manual → 201; 51 MB → 413 with the new message).

## 2026-11-24 — Refuse to start when none of the attached files are found (issue #121)

- Branch `feat/issue-121-refuse-missing-files`. A database copied to a new `database.path` without its `files/` folder started normally: every document showed 0 B and the startup backup archived no files.
- **Spec first** (approved): `doc/configuration.md` gains "Moving your data"; `doc/file-storage.md` describes the startup check and rewrites the (still unimplemented) orphan cleanup so it is skipped when files are missing and moves orphans to `files/.orphans/` instead of deleting them.
- **Prefactor** (no behaviour change): `filestore.ResolveDBPath`, `BaseDir` and `FilesDir` are the one place the `files/` location is derived; `InitDB`, `BackupDB` and the handlers use them.
- **Tests first** at the agreed `db.InitDB` seam: all referenced files missing → error naming the DB path, the `files/` folder and the count, no archive written and an older backup untouched (red first); some missing → starts and warns with the count and first paths; none referenced → as before. The last two passed at once (the warning came with the refusal slice); a mutation dropping the warning made the first of them fail.
- **Fix**: `db.CheckFiles` (reads `equipment_files` and `intervention_files`, tolerates a DB from before attachments) runs in `InitDB` before the backup.
- Verified with `go test ./...`, `make build`, and the built binary on a scratchpad fixture DB: 2 referenced, 0 on disk → refused with exit 1 and no backup; 1 of 2 on disk → warning, backup, server up.
- **Review** (before merge): the startup check now takes the `files/` location from `filestore.BaseDir` like the backup and handlers; a single missing file reads "references 1 attached file, but it is not in …" (test first); the docs no longer describe #122 ("show as missing") and #123 (backup completeness) as if they were built; an unrelated research brief that had been swept into the docs commit was dropped (it stays in that commit's history, 9e7bd47).

## 2026-11-24 — A missing attached file says so in the app (issue #122)

- Branch `feat/issue-122-missing-file-in-app`. A document whose file was gone from disk showed **0 B** with a Download link that failed; a missing photo rendered as a broken image.
- **Spec first** (approved): the `File` table in `doc/file-storage.md` (`missing`, size 0 when missing), `doc/gui/equipments.md` (Documents tab) and `doc/gui/interventions.md` (photo placeholder).
- **API first**: `FileInfo.missing` (required boolean) in `openapi.yaml`, Go stubs and TS client regenerated (both gitignored).
- **Tests first** at the agreed seams, each red first where it could be: `httptest` `TestEquipmentFile_ListReportsAMissingDocument` and `TestInterventionFile_ListReportsAMissingPhoto` (missing true/false, real size, serve still 404); `TestMissingFile_CanStillBeDeleted` passed at once (deleting a missing file already worked; now pinned); Playwright `missing-file-says-so.spec.ts`, file lists stubbed with `page.route`, red on "0 B • …" and the broken `<img>`.
- **Fix**: `statFile` in the handlers sets `size` and `missing` (absent = `fs.ErrNotExist`, as the startup check of #121); the Documents tab shows "File missing on server" and drops Download; `InterventionPhotos` shows a placeholder tile and a placeholder in the delete confirmation, and does not open the viewer.
- Playwright ran against a scratchpad backend on :3001 (reused by `webServer`), so the global setup's wipe never touched `backend/maintenance.db`.
- Verified with `go test ./...`, `pnpm test:unit`, `pnpm run typecheck`, `pnpm test` (62 specs, all pass), `make build`, `curl` on a real missing document (`missing: true`, `size: 0`, serve 404) and a screenshot of the Documents tab.
- **Review** (before merge): merged `main` (#121); the list rows are reused by position, so after a delete a row kept the previous file's Download link, image or placeholder, or showed template source text. The missing/present branches are now reactive functions (arrow-js gotchas 8 and 9), pinned by four Playwright cases (test first). `doc/configuration.md` and the startup-check table in `doc/file-storage.md` now say missing files show as missing in the app and can be deleted. `pnpm test` 66 specs pass.

## 2026-11-24 — An incomplete backup never rotates a complete one away (issue #123)

- Branch `feat/issue-123-skip-rotation-incomplete-backup`, on `main` after #121 merged. A backup of a database whose attached files are partly missing lacked them, yet rotation still counted it and deleted the oldest backup, possibly the last one holding those files.
- **Spec first** (approved): the Backups section of `doc/configuration.md` (incomplete → log, rotation skipped, nothing deleted; the incomplete archive still counts toward `keep` later) and the startup-check section of `doc/file-storage.md`.
- **Tests first** at the agreed `db.BackupDB` seam with `keep: 2` and two older archives: incomplete (2 of 3 referenced files missing) → three archives, both older ones kept, log says "2 attached files" and "rotation skipped" (red first); complete → rotated to 2 (passed at once, current behaviour). Databases with no attached files are covered by the existing rotation tests.
- **Fix**: after writing the archive, `BackupDB` runs `CheckFiles` (the #121 check, no second implementation) on the snapshot it archived; any missing file, or a failed check, skips rotation with a log line.
- Verified with `go test ./...`, `make build`, and the built binary on a scratchpad fixture (`keep: 2`, two older archives): 1 of 2 files missing → three archives and the log line; file restored → next run rotated back to two.
- **Review** (before merge): merged `main` (#122). No code problem found: the check runs `CheckFiles` on the archived snapshot, a failed check skips rotation, `keep: 0` never checks or deletes. The Backups section now says that while files stay missing every start adds an archive, and that rotation resumes once the files are back or their entries are deleted in the app. Re-verified with the built binary (`keep: 2`, two older archives): 2 of 3 files missing → three archives and the log line; files restored → rotated to two. Left as specified: the incomplete archive still counts toward `keep`, so the first complete run after a restore keeps it and drops the older complete ones (the new archive holds every file).

## 2026-11-25 — Release v0.9.0, deployed on this computer

Tagged `v0.9.0` on `main` (536fad3) and pushed the tag. The release pipeline (run 45491677403) passed every job and published the [GitHub release](https://github.com/vtellier/OpenMaintenance/releases/tag/v0.9.0) with the Linux and Windows binaries.

Changes bundled in this release (since v0.8.0):
- **Larger documents** (issue #119): equipment documents up to 50 MB; a refused upload shows the server's reason.
- **Refuse to start when none of the attached files are found** (issue #121): a database moved without its `files/` folder stops startup before any backup is written.
- **A missing attached file says so in the app** (issue #122): `File.missing` in the API; "File missing on server" in the Documents tab, a placeholder for photos, and the entry can still be deleted.
- **An incomplete backup never rotates a complete one away** (issue #123).

No schema change: rolling back to v0.8.0 is safe.

Deployed to the local install (`openmaintenance.service`, `/opt/openmaintenance`, port 20100): binary installed as `openmaintenance-v0.9.0`, symlink repointed, service restarted. Before deploying, all 16 attached files the live database references were checked present. After the restart, `/api/version` answers `v0.9.0`, no missing-file warning was logged, and the startup backup (`database.20261125-082323.tar.gz`, 43.8 MB) holds the files.

## 2026-11-25 — One attachments module (issue #127)

- Branch `refactor/issue-127-attachments-module`, from an architecture review (candidate 1 of 5: deepen attached files into one module). A pure refactor: same routes, `File` object, status codes and messages.
- **Spec first** (approved): `doc/file-storage.md` describes the module, the deletion cascade and the check; task photos marked not implemented yet (#26); ADR 0004 records why the module sits below `db`; `CONTEXT.md` defines **Attachment**.
- **The module**, `backend/internal/attachments`: two kinds (document, photo) that differ only by data; callers name an owner; `Store` adds (cap, sniffed type, generated name, cleanup on failure), lists (with `missing`), opens for serving, deletes one, counts, deletes everything an owner has (rows through the caller's database or transaction, the directory once they are gone), moves an intervention's photos to another equipment (copy, then the caller's save and the path rewrite in one transaction, then delete the originals), and checks the referenced files for startup and the backup. Refusals carry their reason, built from the kind's cap.
- `db`'s equipment, task and intervention delete functions call the module; the handlers no longer remove directories. `filestore` keeps only where the data lives. Gone: the handlers' copies for documents and photos, `db/equipment_file.go`, `db/intervention_file.go`, `models.File`, `models.InterventionFile`, `filestore.CopyFile` and the path helpers.
- **Tests**: no assertion changed and none added; the existing `httptest` suites (upload, list, serve, delete, cascade, move and its rollbacks, missing files, startup check, backup) are the seam. Seven lines that read or seed attachment rows past the API now use the module's `List` or a raw `INSERT`.
- One error-path difference: a failure to read which interventions an equipment has, or to delete attachment rows, now answers 500 instead of being ignored. The rest of the cascade still ignores some errors and is not atomic (#128).
- Bugs found along the way, each its own issue: #128 (cascade not atomic), #129 (photo refusal not shown), #130 (Same hours records 0 h), #131 (intervention saved when its reading is not).
- Verified with `go test ./...` and `make build`.

## 2026-11-25 — Deleting an owner is all or nothing (issue #128)

- Branch `fix/issue-128-atomic-delete`, stacked on #127 and implemented by a subagent. Deleting an equipment, a task or an intervention ran its cascade one statement at a time, outside a transaction, and ignored most errors: a failure could leave rows behind while still answering 204, or answer 500 with part of the cascade already deleted.
- **Spec first:** "Entity deletion cascade" in `doc/file-storage.md`. Step 1 is one transaction: the owner, everything it owns and their attachment rows. Step 2 removes the directories after the commit. A failure rolls back everything and the API answers 500.
- **Test first** (`httptest`, `backend/tests/delete_cascade_atomic_test.go`):
  - Setup: an equipment with a document, a task with an intervention, and an exceptional intervention, each intervention with a photo.
  - A `RAISE(ABORT)` trigger makes one table's delete fail. There are 10 cases, one per owner and table.
  - Each case expects 500, with everything still served, listed and on disk.
  - 8 cases failed before the fix. The other 2 already passed, because the failing statement ran first; they stay as guards.
- **Fix:** `db/delete.go` runs each delete through `deleteInTx`, whose reads and writes all use the transaction, and removes files only after the commit. `DeleteInterventionsByTask` and `DeleteTasksByEquipment` are now unexported helpers that take the transaction.
- **Review:**
  - The built binary ran on seeded data.
  - A live `BEFORE DELETE ON interventions` trigger gave 500, with the equipment, its task, its document and its photo, and both files on disk, all still there.
  - Without the trigger the same delete answered 204 and left no rows and no directory.
  - One CI review note led to a comment on why the task loop finds no photo rows left.

## 2026-11-25 — A refused photo upload says why (issue #129)

- Branch `fix/issue-129-photo-refusal-reason`, implemented by a subagent. It is the photo twin of #119: `InterventionPhotos` caught every upload error and showed "Failed to upload photo", even when the backend had answered 413 or 415 with the reason.
- **Spec first:** the photo section of `doc/gui/interventions.md` now names the accepted images and the 10 MB cap, and says a refusal shows the server's reason.
- **Test first** (Playwright, `photo-upload-error-shows-reason.spec.ts`), with three cases:
  - a text file gets 415 from the real backend;
  - a 413 is stubbed, as #119 did;
  - a 502 with no reason keeps the generic message.
  
  The first two failed on the generic banner before the fix. The third guards the fallback.
- **Fix:** `onUploadChange` uses `extractErrorMessage(err, 'Failed to upload photo')`, as the Documents tab does.
- **Review:** merged `main` (#127, #128). Checked in Chrome against the built binary:
  - a text file shows "only JPEG, PNG, WebP and GIF images are allowed";
  - a real 10 MB+ PNG shows "file exceeds the 10 MB limit";
  - an upload that failed at the network level shows the fallback.
  
  The spec header now names the fix commit.

## 2026-11-25 — No "Same hours" for an equipment with no reading (issue #130)

- Branch `fix/issue-130-no-same-hours-without-reading`, implemented by a subagent. An equipment that tracks hours but has no reading yet showed in the Dashboard banner with a **Same hours** button. One tap recorded `0 h`, a reading the user never entered.
- **Spec first:** `doc/gui/dashboard.md` (the banner, and the "Dismiss the reminder" flow) and `doc/data-model.md` (freshness) now say Same hours confirms the current reading, so it is offered only when there is one.
- **Test first:**
  - Vitest on a new `sameHoursReading(eq)` in `lib/hourMeterFreshness.ts`, covering 1245 h, an entered 0 h, and no reading.
  - A Playwright spec, `dashboard-no-same-hours-without-reading.spec.ts`. It failed on the unfixed page because the Same hours button was present.
  - The #34 spec tapped Same hours on an equipment with no reading, so it relied on the bug. It now starts from a 120 h reading made to look 10 days old.
- **Fix:** the page offers Same hours only when `sameHoursReading` returns a reading, and sends that reading. The old `eq.hours ?? 0` is gone.
- **Review:**
  - Merged `main` (#127, #128, #129).
  - The button slot switches between `null` and a template, so it is now rendered through a function slot (arrow-js gotchas 8 and 9). This is safe either way today, because rows with no reading always sort first.
  - Both dashboard specs pass.
  - Checked in Chrome on seeded data plus an equipment with no reading. Its row shows only Update. Same hours on the Yanmar moved it to the fresh group, and the row with no reading kept only Update.

## 2026-11-25 — An intervention and the reading it raises are saved together (issue #131)

- Branch `fix/issue-131-intervention-and-reading-together`, implemented by a subagent and stacked on #127. Logging or editing an intervention stored it first, then raised the equipment's hour-meter reading. A failure of the second step was only logged, and the API still answered 201 or 200.
- **Spec first:** a bullet under the intervention side effects in `doc/data-model.md`.
- **Test first** (`httptest`, `backend/tests/intervention_reading_together_test.go`): a `BEFORE UPDATE OF hours ON equipments` trigger makes the reading write fail, in three cases:
  - log: 500, no intervention, and the reading and its freshness unchanged;
  - edit: 500, and the intervention unchanged;
  - move to another equipment: 500, and the intervention and its photo stay on the first equipment.
  
  All three failed before the fix, which answered 201 or 200.
- **Fix:**
  - `hourmeter.RecordIntervention` takes the caller's `*sql.Tx`, and any error aborts it.
  - `db` gains `InTx`, `CreateInterventionTx`, `GetEquipmentTx` and `SetEquipmentHoursTx`.
  - The handlers save the intervention and record its reading in one transaction. For a move, that is the attachments module's move transaction.
  - `db.UpdateIntervention`, which committed on its own, is gone, so an edit cannot be saved without its reading.
- **Review:**
  - Merged `main` (#128, #129, #130); `deleteInTx` from #128 is now built on `InTx`.
  - Checked on the built binary with seeded data and a live trigger on the reading write. Logging answered 500 with no intervention added and the reading unchanged.
  - Moving an intervention with a photo to another equipment answered 500. The intervention, its photo and the target's reading stayed put.
  - With the trigger dropped, logging added the intervention and raised the reading (512 → 532). The move put the photo under the new equipment and raised that equipment's reading (230 → 532).

## 2026-11-25 — `make seed` refuses a database that already holds data (issue #140)

- Branch `fix/issue-140-seed-refuses-seeded-db`, implemented by a subagent. A second `make seed` on the same database created the first equipments again, then stopped on a 409 for the Winches group. That left duplicates and half the demo data.
- **Decision:** seed refuses up front instead of reusing what exists.
- **Refactor:** seeding moved from `main` into `run(baseURL, client, out)`, which returns its first error instead of exiting.
- **Test first** (`backend/cmd/seed/main_test.go`): it runs the seeder against the real API on a temp DB over `httptest`. On an empty database it seeds 6 equipments and 1 group. A database that was already seeded, or holds only a group or only an equipment, must make it fail with the counts and send no POST. Before the fix, a second run sent 25 POSTs and then hit the 409.
- **Fix:** before creating anything, `run` lists the equipments and groups and refuses when either is not empty. No new endpoint.
- **Docs:** CONTRIBUTING, README, the run-openmaintenance skill and the review-pr command now say seed needs an empty database.

## 2026-11-25 — Attachment storage hardening (issue #138)

- Branch `fix/issue-138-attachment-store-hardening`, implemented by a subagent. Three weaknesses in `internal/attachments/store.go`, found by inspection.
- **Spec:** the upload and serve steps in `doc/file-storage.md`.
- **Test first** (in-package, `backend/internal/attachments/store_test.go`): two package-internal swap points, `createFile` and `randSource`, make the stored file's sync or close fail, or the random source fail. All three cases failed before the fix, because `Add` stored the attachment anyway.
- **Fix:**
  - `Add` syncs the stored file and checks its close, as `copyFile` does. On failure it removes the file and inserts no row.
  - `randomName` returns an error instead of the fixed name `file`, and `Add` fails with it.
  - Reading each attachment's type from disk in `List` and `Open` is kept as an accepted cost: an owner has few files, and storing the type would need a migration. A comment beside `attachment()` says so.

## 2026-11-25 — The 10 MB photo cap has a backend test (issue #137)

- Branch `test/issue-137-photo-cap-test`, implemented by a subagent. The document cap had a 413 test, the photo cap had none; #129's frontend spec stubs the 413.
- **Tests** (`httptest`, `backend/tests/intervention_file_test.go`), on PNGs padded to size so they are refused for size, not type:
  - 10 MB + 1 byte: 413, body exactly `{"error":"file exceeds the 10 MB limit"}`, an empty photo list and no file under `files/`;
  - exactly 10 MB: 201, listed at 10485760 bytes.
- Both pass on current code, so no fix was needed. Raising the cap to 11 MB by hand turned the first test red.

## 2026-11-25 — Deleting a photo logs no Arrow.js error (issue #139)

- Branch `fix/issue-139-arrow-expression-pool`, implemented by a subagent. Deleting a photo tile logged `TypeError: expressionPool[effect] is not a function` from Arrow.js. The Documents tab was not affected.
- **Test first** (Playwright, `missing-file-says-so.spec.ts`): the four row-reuse delete cases collect `pageerror` events and expect none. Both photo cases failed before the fix.
- **Root cause:** `InterventionPhotos` cleared `deletingName` in a `finally` after the reload. Each tile's Delete button watches it. The reload had already re-rendered the grid, but Arrow tears the dropped tile down a microtask later. Clearing the flag in between queued that tile's watcher. Arrow's `watch()` stop does not remove an already-queued rerun, so the watcher then ran on a released expression slot and threw.
- **Fix:** clear `deletingName` before the reload; the error path clears it and returns. New arrow-js gotcha 10 describes the pitfall and the upstream cause.
- **Follow-up:** #145 lists the other handlers that reset a flag in a `finally` after a reload, the same shape as this bug.

## 2026-11-25 — The Playwright suite passes five runs in a row (issue #147)

- Branch `test/issue-147-stable-suite`, implemented by a subagent. Step 0.1 of the React migration (epic #146): the suite must be trusted before it proves the port.
- **Five runs on `main`:** 70/70 passed each time, with no retries configured. No spec was found flaky.
- **`waitForTimeout` removed:** "a slow page-load status does not overwrite a newer check result" (`manual-update-check.spec.ts`) slept 300 ms to give the page time to apply the late GET it must ignore. It now waits for a sign that the page has handled that response: an init script wraps `fetch`, and once the page has read the JSON it marks `<html>` after a 0 ms timer, an animation frame and a `MessageChannel` message. The first hop covers Arrow's microtask re-render; the last covers React's scheduler, which renders in a posted-message task (review finding: a 0 ms timer alone could beat it). Removing the app's `checkStarted` guard by hand turns the test red, at the `toBeVisible` after the mark. A time-sliced or timer-deferred render could still land after the mark, so 1.3 (#157) must repeat that guard-removal check under React. `frontend/tests/` holds no `waitForTimeout` now, and gotcha 8 of the non-regression-test skill says why.
- **Two failed local runs had a cause outside the suite:** the laptop's Wi-Fi dropped and reconnected every few seconds. Chromium then aborts even `localhost` requests (`net::ERR_NETWORK_CHANGED`), so pages never loaded. Five later runs on a steady network passed, and the suite passed in five Pipeline runs on the branch. The PR lists both sets.
- **Pipeline runs on the branch:** six dispatched, one after the other. The suite ran in five of them and passed 70/70 each time. Three runs still failed, all at "Generate TypeScript API client": Maven Central answered 429 when the openapi-generator jar was downloaded. One of those three stopped `test-frontend` before the suite ran. #164 tracks caching the jar.
- **Review round:** the update-status mark now waits for a timer, an animation frame and a posted message, so it also holds for a React re-render (see above). On that commit (`a7653ba`), the PR's own Pipeline run and four dispatched after it, one after the other, all passed: every job green, the suite 70/70 each time, no 429. That is five consecutive CI runs of the suite. Later commits on the branch change docs only.

## 2026-11-25 — Any page error or console error fails a Playwright test (issue #148)

- Branch `test/issue-148-fail-on-console-errors`, implemented by a subagent. Step 0.2 of the React migration (epic #146): after the cutover, React's warnings and uncaught exceptions must fail the suite.
- **Fixture:** `frontend/tests/fixtures.ts` extends Playwright's `test`. It overrides `context` to collect every uncaught page error (`weberror`, the `pageerror` of any page in the context) and every console message of type `error`, and fails the test with the list at teardown. All 41 specs import `test` and `expect` from it; none imports `@playwright/test` any more.
- **Declared errors:** `expectErrors(...)` declares what a test provokes on purpose. `failedRequest(path, status)` matches Chromium's "Failed to load resource" console error for that request path only. Every declared error must be logged at least once (polled for up to 2 s at teardown), and any other error still fails the test.
- **What the app logged during the suite:** only failed requests, all on purpose: 12 tests across the `*-error-shows-reason` specs, `manual-update-check` (aborted check) and `update-status-not-shown-when-check-pending` (aborted status). They now declare them. No `console.error` call and no uncaught exception, so no issue was opened and no app code changed.
- **Test-data fix:** the two row-reuse photo cases in `missing-file-says-so.spec.ts` stubbed a "present" photo whose bytes were not on the backend, so its `<img>` 404'd. The stub now serves a 1×1 PNG. Their local `pageerror` collector is gone: the fixture does that job. Bringing the #139 bug back by hand still fails both cases, listing `expressionPool[effect] is not a function`.
- **Checks:** a deliberate `console.error` and a deliberate uncaught error in `entry-client.ts` each failed the specs and were listed (then removed); a declared error that never happens fails too. The full suite passed three runs in a row, 70/70. The specs type-check with a scratch tsconfig that adds `tests/` (one stale `createTreeWalker` argument fixed); `pnpm run typecheck` still covers `src/` only.
- **Review round:** the reviewer's full runs failed on Google Fonts requests (`net::ERR_NETWORK_CHANGED` on `fonts.gstatic.com`), which the fixture now counts as errors. The fixture keeps the suite off the internet: it answers the Google Fonts stylesheet with an empty one, so no font file is requested, and blocks any other request off `localhost`/`127.0.0.1` (a blocked request fails the test every time instead of only when the network flaps). Requests to the app are not routed. Before the check it also waits one frame and one task on each open page, so an error thrown just after the last step is caught; a never-logged declaration and undeclared errors are now reported together; matchers are normalised once. The skill and the test README say so, plus how React warnings arrive (`%c%s` unapplied). Local: full suite 70/70 twice, about 30 s a run instead of 1.1 min; a deliberate `console.error` still fails `smoke` and a declaring error spec.
