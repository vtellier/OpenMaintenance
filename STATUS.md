# Session History

## 2026-05-13

- Cleaned up AGENTS.md: removed redundant inline Arrow.js content (now references the skill file instead)
- Fixed stale React references in README.md (project uses Arrow.js)
- Created STATUS.md for session history tracking
- Removed build artifacts (`backend.log`, `OpenMaintenance`, `tmp-main`)
- Removed empty `cmd/` directory
- Added `backend/.gitignore` for build artifacts and logs
- Created root `Makefile` with `generate-openapi`, `build-backend`, `build-frontend` targets
- Added operationId to every path in `backend/api/openapi.yaml` + added missing sub-resource routes
- Regenerated Go code from OpenAPI spec
- Replaced raw Echo route handlers with `generated.ServerInterface` implementation via `handlers.Handler`
- Updated `main.go` to use `RegisterHandlersWithBaseURL`
- Removed old `backend/internal/routes/` directory (equipment.go, task.go, intervention.go, views.go)
- Removed unused `gofiber/fiber/v2` dependency and stale `views.go` referencing React/Fiber
- Created ROADMAP.md with milestone-based development tracking
- Created `/update-roadmap` custom command in `.opencode/commands/update-roadmap.md`
- Added ROADMAP.md update ritual to AGENTS.md session rituals
- Added `tracks_hours`, `hours`, `hours_updated_at` to Equipment in OpenAPI schema, Go model, DB schema, DB functions, handlers
- Regenerated TypeScript API client
- Checked off Milestone 1 items 1-3 in ROADMAP.md
- Added `hours_at` to Intervention in OpenAPI schema, Go model, DB schema, DB CRUD functions
- Regenerated TypeScript API client
- Checked off Milestone 1 items 4-7 in ROADMAP.md
- Added computed due_status, next_due_date, next_due_hours to Task in OpenAPI schema, Go model
- Created logic package with ComputeDueStatus (handles months and hours intervals, no-intervention baselines)
- Added GetLastInterventionByTask DB function
- Enriched all task handlers (List, Get, Create, Update) with due-status computation
- Regenerated TypeScript API client
- Milestone 2: Validated task intervals (at least one required, hours_interval needs tracks_hours)
- Milestone 2: Validated intervention date is not in the future
- Milestone 2: Cascade delete (equipment→tasks→interventions, task→interventions)
- Milestone 2: Auto-update equipment hours when intervention records higher hours_at
- Milestone 3: Created NavBar (desktop top navbar + mobile bottom tab bar with active highlighting)
- Milestone 3: Created App shell wrapping NavBar + page content
- Milestone 3: Created page components (DashboardPage, EquipmentsPage, EquipmentDetailPage with 3 sub-tabs, HistoryPage, SettingsPage)
- Milestone 3: Created page.ts router matching all 6 routes (+ 404)
- Fixed `Error: Invalid HTML position` — root cause was Arrow.js template parser mismatch when `${}` expressions appear inside HTML attribute values adjacent to text (e.g., `class="foo${expr}"`); fixed by making attributes full expressions (`class="${'foo' + expr}"`)
- Fixed same issue in EquipmentDetailPage sub-tab href and class attributes
- Verified all 6 routes return 200 in production build via curl
- Verified all routes render correctly in chrome-devtools (desktop + mobile viewports)
- Cleaned up stale dev server processes
- Milestone 3: Light/dark/auto theme support
  - Created `frontend/src/theme.ts` module (get/set/resolve/apply theme)
  - Added light theme CSS variables in `[data-theme="light"]` and made dark the default in `:root, [data-theme="dark"]`
  - Replaced hard-coded hover colors (`#3f3f46`, `#27272a`) with CSS variables
  - Added `color-scheme: dark/light` for proper browser UI theming
  - Updated SettingsPage with radio-button theme picker (Auto/Light/Dark) and About section (version, repo, license)
  - Added inline `<script>` in SSR head to apply stored theme before first paint (prevents flash)
  - Added `prefers-color-scheme` listener in client entry for Auto mode reactivity
  - Fixed EquipmentCard, TaskCard, InterventionCard type errors (wrong API method names, type mismatches)
  - Fixed App.ts pageContent type (unknown → ArrowExpression)
  - Fixed ApiTestPage import and API method usage
  - Milestone 4: Equipment screens (full implementation)
    - Rewrote EquipmentsPage with live data loading (equipments + tasks + interventions), card grid, add modal (name, description, tracks_hours toggle, initial hours), empty state with CTA, mobile FAB
    - Rewrote EquipmentDetailPage with live data: header (name, hours, Update hours/Edit/Delete buttons), 3 tabs (Tasks with urgency indicators, History from interventions, Info read-only), modals for edit (full equipment form), delete confirmation, hours update, tracks_hours confirmation dialog
    - Created lib/format.ts for shared utilities (relativeTime, formatDate, formatHours, staleness helpers)
    - Added CSS for equipment grid cards, modals, toggle switches, urgency indicators, form fields, flash messages, mobile FAB

## 2026-05-13 (session 2)

- Fixed "Invalid HTML position" SSR crash on EquipmentDetailPage — root cause: `${equipmentId}` in `href="/equipments/${equipmentId}/edit"` was a mid-attribute expression that Arrow.js template parser cannot handle (the `<!--¤-->` placeholder becomes literal attribute text instead of a DOM comment node, causing placeholder count mismatch). Fix: pre-compute href values as variables and use full-attribute expressions (`href="${editHref}"`).
- Fixed add modal not opening in EquipmentsPage — `addModal` was a static variable evaluated once instead of a reactive function. Fixed by pre-computing `addModalHtml` template and wrapping it in `() => state.showAddModal ? addModalHtml : null`.
- Removed dead code: EquipmentCard.ts, TaskCard.ts, InterventionCard.ts, MainPage.ts, ApiTestPage.ts (none are imported by active code).
- Fixed entry-server.ts type error (`ReturnType<typeof routeToPage>` is `Promise<Page>` not `Page`).
- Verified all builds pass: `pnpm run typecheck` (tsc), `pnpm run build` (vite client+ssr), `go build ./...` (backend).

## 2026-05-13 (session 3)

- Completed Milestone 4: created three new pages for equipment management:
  - **Edit page** (`/equipments/:id/edit`): full form (name, description, tracks_hours toggle, current hours), validates name required, confirms before enabling tracks_hours when tasks have hours_interval, saves via `updateEquipment` API and redirects to detail page.
  - **Delete page** (`/equipments/:id/delete`): confirmation with equipment name and cascade-delete warning, deletes via `deleteEquipment` API and redirects to equipments list.
  - **Update hours page** (`/equipments/:id/edit/hours`): shows current hours, validates new hours >= current, saves via `updateEquipment` API.
- Registered all three routes in `page.ts` before the detail route to match specific paths first.
- Added CSS for form pages (`.form-page`, `.form__actions`, `.btn--danger`).
- Fixed SSR crashes caused by `component()` wrapping arguments in reactive proxies (native methods like `parseInt` fail on proxy strings). Fix: capture `id` in outer closure, pass plain number/href into `component()`.
- Fixed server crash from `document is undefined` during SSR reactive updates when using `reactive()` outside `component()` wrapper.
