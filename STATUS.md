# Session Summary

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
