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
- [x] Tasks grouped by equipment, sorted by urgency (overdue/due-soon only; OK tasks hidden)
- [x] "Mark done" quick-log from each task row
- [x] Empty state: "You're all caught up. Nothing due right now." + CTA if no equipments exist

## Milestone 8 — Interventions & Global History

- [x] Full intervention form (equipment picker, task picker, date, hours, location, comments)
- [x] Global history screen (reverse-chronological list, filter by equipment and date range)
- [x] "+" log intervention CTA from global History and per-equipment History tab
- [x] Edit intervention from history (global + per-equipment)
- [x] Delete intervention from history with confirmation (global + per-equipment)

## Milestone 9 — Settings

- [x] Theme toggle (Auto / Light / Dark)
- [x] About section (version, repo link, license)

## Milestone 10 — Reactivity Bug Fixes

- [ ] **Task list not refreshed after add**: task list stays empty after saving a new task — requires page reload to appear
- [ ] **Task card not updated after mark done**: "Last: never" stays stale after logging an intervention — requires page reload to reflect the new date

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

## Future (post-V1)

- Configurable "due soon" window
- Configurable hour-meter staleness threshold
- Configurable date format
- CSV export
- Email/push notifications
- File attachments
- Mobile app (native)

> See [`doc/overview.md`](./doc/overview.md) for the product vision and [`doc/data-model.md`](./doc/data-model.md) for data model details.
