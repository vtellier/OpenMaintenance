# Session Summary

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
