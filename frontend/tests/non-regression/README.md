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
