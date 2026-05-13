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

- [ ] URL routing (all 6 routes: `/`, `/equipments`, `/equipments/:id`, `/equipments/:id/history`, `/equipments/:id/info`, `/history`, `/settings`)
- [ ] Navigation shell (top navbar on desktop, bottom tab bar on mobile)
- [ ] Light/dark/auto theme support
- [ ] Responsive layout

## Milestone 4 — Equipment Screens

- [ ] Equipment list (grid of cards with name, description, hour-meter, last intervention, next due)
- [ ] Equipment detail screen with 3 tabs: Tasks, History, Info
- [ ] Add equipment flow
- [ ] Edit equipment flow
- [ ] Delete equipment (with confirmation)
- [ ] Hour-meter update flow (reachable from dashboard, equipment detail, and equipment list)
- [ ] Confirm before enabling `tracks_hours` on existing equipment that has tasks using `hours_interval`

## Milestone 5 — Task Management

- [ ] Task list with urgency indicators (overdue = red, due soon = amber)
- [ ] Add task flow
- [ ] Edit task flow
- [ ] Delete task (with confirmation)
- [ ] "Mark done" quick-log from task row (opens intervention quick-log modal pre-filled with task)

## Milestone 6 — Dashboard

- [ ] Hour-meter freshness banner (collapsible, stale entries emphasized, "Update hours" CTA per equipment)
- [ ] Tasks grouped by equipment, sorted by urgency
- [ ] "Mark done" quick-log from each task row
- [ ] Empty state: "You're all caught up"

## Milestone 7 — Interventions & History

- [ ] Quick-log modal (date, hours, comments — accessible from Dashboard and Tasks)
- [ ] Full intervention form (equipment picker, task picker, date, hours, location, comments)
- [ ] Global history screen (chronological, filters by equipment and date range)
- [ ] Per-equipment history tab
- [ ] Edit intervention from history
- [ ] Delete intervention from history (with confirmation)
- [ ] Side effects on intervention save (task next-due recomputed, equipment hours updated)

## Milestone 8 — Settings

- [ ] Theme toggle (Auto / Light / Dark)
- [ ] About section (version, repo link, license)

## Future (post-V1)

- Configurable "due soon" window
- Configurable hour-meter staleness threshold
- Configurable date format
- CSV export
- Email/push notifications
- File attachments
- Mobile app (native)

> See [`doc/overview.md`](./doc/overview.md) for the product vision and [`doc/data-model.md`](./doc/data-model.md) for data model details.
