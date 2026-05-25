# Session Summary

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
