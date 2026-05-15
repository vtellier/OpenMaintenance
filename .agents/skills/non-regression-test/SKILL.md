---
name: non-regression-test
description: Write or run Playwright non-regression tests for OpenMaintenance frontend bugs. Use when fixing a frontend bug, when asked to pin a bug with a test, or when asked to run the test suite.
---

# Non-regression test (Playwright)

Use this skill whenever you fix a frontend bug, or when you are asked to add or run a Playwright test for OpenMaintenance.

## Where things live

- Config: `frontend/playwright.config.ts`
- Global setup (wipes DB via API before every run): `frontend/tests/global-setup.ts`
- Specs: `frontend/tests/non-regression/*.spec.ts`
- Index (must be kept in sync): `frontend/tests/non-regression/README.md`
- Run command: `pnpm test` from `frontend/`

The harness assumes both servers are running:
- backend on `http://localhost:3001` (`go run .` from `backend/`)
- frontend on `http://localhost:5173` (`pnpm dev` from `frontend/`)

If either is missing, global setup fails with a clear message.

## Workflow when fixing a frontend bug

1. Reproduce the bug manually (chrome-devtools MCP is fine for exploration).
2. **Before writing the fix**, check `frontend/tests/non-regression/` for an existing spec covering the bug. If one exists and currently passes, the bug isn't pinned — that's a gap; treat it as a new spec to add.
3. Write a spec that **fails on the current (buggy) code** if at all possible. Run `pnpm test` to confirm it fails for the right reason.
4. Apply the fix.
5. Run `pnpm test` again. The new spec must pass; all existing specs must still pass.
6. Add a row to the index table in `frontend/tests/non-regression/README.md`.

## Spec file template

Keep specs short. Navigate, act, assert. No page objects, no fixtures, no helpers (until duplication actually hurts).

```ts
import { expect, test } from '@playwright/test'

/**
 * Bug: <one-line title>
 * Roadmap: Milestone <N> — "<exact roadmap bullet>"
 * Fixed in: <commit-sha or "open">
 */
test('<short scenario>', async ({ page }) => {
  // Arrange — create data via UI or API as needed (DB starts empty).
  await page.goto('/equipments')
  // ... actions

  // Assert the fixed behavior, not the absence of the bug symptom.
  await expect(page.getByText('Expected text')).toBeVisible()
})
```

## Naming

- File name = kebab-case description of the bug, ending in `.spec.ts`.
  Examples: `safedate-shows-nan.spec.ts`, `intervention-date-rfc3339.spec.ts`, `hours-updated-at-on-create.spec.ts`.
- Test title = the user-visible scenario, not the technical cause.
  Good: `'logging an intervention saves and closes the modal'`.
  Bad: `'POST /interventions accepts RFC3339 date'` (that's an API test, not a frontend non-regression).

## Locators — preference order

1. `page.getByRole(...)` — best, mirrors accessibility tree.
2. `page.getByText(...)` / `getByLabel(...)` / `getByPlaceholder(...)`.
3. `page.locator('css-selector')` — only when the above don't fit.
4. **Avoid** XPath, nth-child, or anything tied to DOM structure that may change.

Never use auto-generated chrome-devtools `uid` values in specs — those are session-scoped and meaningless outside the MCP.

## Translating a chrome-devtools MCP reproduction into a spec

When you reproduced a bug interactively with chrome-devtools MCP, you have a sequence like:
- `navigate_page http://localhost:5173/equipments`
- `click uid=42` (the "Add equipment" button)
- `fill uid=51 "Test"` (the name input)
- ...

Translate it as follows:
- `navigate_page` → `await page.goto(url)`
- `click uid=X` → identify the element from your snapshot (its role/text/label), then `await page.getByRole('button', { name: 'Add equipment' }).click()`.
- `fill uid=X "value"` → same — find the visible label or placeholder: `await page.getByLabel('Name').fill('Test')`.
- `take_snapshot` → no equivalent; just assert what you would have visually verified.

## Database state

- Global setup deletes every equipment via `DELETE /api/equipments/:id`. Cascade handles tasks and interventions.
- Each test starts with an empty DB.
- Specs may share the run, but **must not depend on each other**. Each spec creates whatever data it needs.
- `playwright.config.ts` runs with `workers: 1` and `fullyParallel: false` — do not change without rewriting global setup to scope per-worker.

## Gotchas / Pitfalls

### 1. Don't assert on the bug symptom; assert on the fixed behavior

The symptom of "save returns 400" is a stuck modal. A spec that asserts "modal still open" passes both when broken (modal stuck) and when fixed (if you forgot to close it). Assert what success looks like: row appears in the list, modal is gone, success toast, etc.

### 2. Date / time assertions are brittle

Don't compare against `new Date().toISOString()` in the test — the backend may add milliseconds and the test will race. Match a prefix (`YYYY-MM-DD`) or use a date-agnostic check ("any intervention is now visible").

### 3. Re-running locally with leftover data

If global setup fails (e.g., backend was down when you started), the DB is not wiped. Restart the backend and rerun. Don't manually delete `backend/bin/maintenance.db` while the backend holds it open.

### 4. Servers on non-default ports

If `pnpm dev` falls back from `:5173` to `:5174` (port already in use), the tests will hit the wrong page. Confirm the frontend log says `http://127.0.0.1:5173` before running tests. Same for backend (`:3001`).

### 5. Generated API client changes do not require a test update

Specs hit the live API through the browser. Regenerating `frontend/generated/api` doesn't affect specs unless types in the spec broke — in which case fix the spec, don't pin to a stale type.

### 6. Tests share DB state within the same run — use unique names and scoped selectors

Global setup wipes the DB once per `pnpm test` invocation. Tests run sequentially after that, and every piece of data a test creates **persists for all later tests** in the same run.

Two failure patterns this causes:

**Wrong row selected** — `.first()` or `.nth(0)` on a list grabs a row left by an earlier test instead of the current test's row. Use a row-scoped selector instead:
```ts
// ❌ Grabs the first Del button on the page — may belong to a previous test's item
await page.getByRole('button', { name: 'Del' }).first().click()

// ✅ Scopes to the specific row this test owns
await page.locator('.history-item')
  .filter({ hasText: 'My Task' })
  .getByRole('button', { name: 'Del' })
  .click()
```

**Misleading retry count** — `14 × locator resolved to <p>My Task</p>` in a failure message does **not** mean 14 DOM elements. It means Playwright retried the assertion 14 times within the 5-second timeout. Don't assume duplicate data — check whether the right row was targeted.

**Rule**: Give each test file unique, descriptive data names (e.g., `"Delete Test Equipment"` instead of `"Test Equipment"` which another test also creates). Never rely on `.first()` to find a specific item in a shared list.

### 7. Trace files are kept on failure only

`playwright.config.ts` uses `trace: 'retain-on-failure'`. To debug a failing spec, run `npx playwright show-trace test-results/.../trace.zip`. Don't commit `test-results/` (already in `.gitignore`).

## Updating the index

After adding a spec, append a row to `frontend/tests/non-regression/README.md`:

```md
| `<file>.spec.ts` | <one-line bug description> | Milestone <N> |
```

Keep the table in roughly chronological order (newest at the bottom).

## Running

```sh
pnpm test            # headless, all specs
pnpm test:ui         # interactive UI mode (debug)
pnpm test <file>     # single spec
```

Exit code is 0 on pass, non-zero on fail — suitable for any future CI without modification.
