# Non-regression tests

One spec per fixed bug. Each spec reproduces the bug as it appeared, then
asserts the fixed behavior. If the spec fails again, the bug is back.

## Running

Both servers must already be running:

```sh
# terminal 1
cd backend && go run .

# terminal 2
cd frontend && pnpm dev

# terminal 3
cd frontend && pnpm test
```

The DB is wiped (via the REST API) before the run. See
`frontend/tests/global-setup.ts`.

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
