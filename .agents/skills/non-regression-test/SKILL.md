---
name: non-regression-test
description: Write or run Playwright non-regression tests for OpenMaintenance frontend bugs. Use when the bug is in rendering, interaction or reactivity, or when asked to add or run the Playwright suite. Backend bugs use the go-test skill instead.
---

# Non-regression test — Playwright (frontend branch)

This is the **Playwright branch** of the bug-fix process. It covers bugs that live in the browser: rendering, interaction, reactivity.

It is **not** the only way to pin a bug. Pick the branch first:

| Bug lives in | Skill to load | Failing test goes in |
|---|---|---|
| Go business logic, or the API contract | [`.agents/skills/go-test/SKILL.md`](../go-test/SKILL.md) | `backend/internal/<pkg>/*_test.go` or `backend/tests/*_test.go` |
| Frontend rendering / interaction / reactivity | **this skill** | `frontend/tests/non-regression/*.spec.ts` |

The branching decision itself is Step 3.5 of [`.agents/skills/bug-fix/SKILL.md`](../bug-fix/SKILL.md). Rule of thumb: pin the bug at the lowest layer that can produce it, and reach for a Playwright spec when the browser can break independently of the backend. Use this skill whenever you are asked to add or run a Playwright test for OpenMaintenance.

## Where things live

- Config: `frontend/playwright.config.ts`
- Global setup (wipes DB via API before every run): `frontend/tests/global-setup.ts`
- Shared fixture (fails a test on any page error or console error): `frontend/tests/fixtures.ts`
- Specs: `frontend/tests/non-regression/*.spec.ts`
- Index (must be kept in sync): `frontend/tests/non-regression/README.md`
- Run command: `pnpm test` from `frontend/`

Playwright's `webServer` block starts both servers itself, or reuses them if they are already running:
- backend on `http://localhost:3001` (`go run .` from `backend/`)
- frontend on `http://localhost:5173` (`pnpm dev` from `frontend/`)

**Warning:** when Playwright starts the backend itself, it uses `backend/maintenance.db` (the same DB as `make dev`), and the global setup deletes every equipment in it. Running the suite against already-running dev servers does the same. Back up the DB first if it holds data you want to keep.

## Workflow when fixing a frontend bug

0. Confirm it really is a frontend bug: if `curl` against the backend already returns the wrong data, stop here and use the [go-test skill](../go-test/SKILL.md) instead.
1. Reproduce the bug manually (chrome-devtools MCP is fine for exploration).
2. **Before writing the fix**, check `frontend/tests/non-regression/` for an existing spec covering the bug. If one exists and currently passes, the bug isn't pinned — that's a gap; treat it as a new spec to add.
3. Write a spec that **fails on the current (buggy) code** if at all possible. Run `pnpm test` to confirm it fails for the right reason.
4. Apply the fix.
5. Run `pnpm test` again. The new spec must pass; all existing specs must still pass.
6. Add a row to the index table in `frontend/tests/non-regression/README.md`.

## Spec file template

Keep specs short. Navigate, act, assert. No page objects, no helpers (until duplication actually hurts), and no fixtures besides the shared one.

Import `test` and `expect` (and the `Page` type) from `../fixtures`, **never from `@playwright/test`**. See [Page errors and console errors fail the test](#page-errors-and-console-errors-fail-the-test).

```ts
import { expect, test } from '../fixtures'

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

## Page errors and console errors fail the test

`frontend/tests/fixtures.ts` extends Playwright's `test`. For every test it collects the uncaught exceptions of the page (`pageerror`) and every console message of type `error`, and at teardown it fails the test with the list. So an error the app logs fails the suite even when the screen looks right, and so will React's warnings after the cutover (#146).

Chromium also logs a console error for every request that gets an HTTP error status or is aborted (`Failed to load resource: ...`). A test that provokes an error on purpose declares it with the `expectErrors` fixture, before the action:

```ts
import { expect, failedRequest, test } from '../fixtures'

test("a refused Update hours shows the backend's reason", async ({ page, expectErrors }) => {
  // ... create eq
  expectErrors(failedRequest(`/api/equipments/${eq.id}/hours`, 400))
  // ... act, assert the reason is shown
})
```

- `failedRequest(path, status)` matches the error for that request path only: a number is the HTTP status, a string such as `'net::ERR_FAILED'` is the network error of a `route.abort()`.
- Any other matcher: a string matches the message exactly, a RegExp matches part of it (anchor it), `{ message, path }` also pins the URL. For a failed request that URL is the request's; for a page error it is the page's.
- Every declared error must be logged at least once, and any other error still fails the test. One declaration accepts every error it matches, so a request that fails three times is declared once. Keep declarations narrow: an exact message, a tight pattern, and the path when there is one.
- An error that is not on purpose is a bug: fix it. If the fix is not small, open an issue, declare that exact message, and put a comment that points to the issue next to the declaration.
- React warnings reach the fixture with their format placeholders unapplied: `console.error('%c%s', 'color: …', 'Warning: Each child …')` is collected as `%c%s color: … Warning: Each child …`. A plain string can never match it; declare it with an anchored RegExp on the stable part.
- A stubbed file list (`page.route`) must also serve the bytes of any file the page loads, or its 404 fails the test (see `stubFileList` in `missing-file-says-so.spec.ts`).
- Before the check, the fixture waits one animation frame and one task on every open page, so an error thrown on the frame or tick after the last step is caught. A longer timer can still be missed: end a spec on an assertion, not on an action.
- The fixture covers the test's `context` and every page in it (`page`, `context.newPage()`, popups). A context made with `browser.newContext()` is not covered: use the `context` fixture instead.

### The suite never reaches the internet

The same fixture routes every request that leaves the app's hosts (`localhost`, `127.0.0.1`), so a slow or unreachable third party cannot fail a test:

- The Google Fonts stylesheet that `index.html` loads is answered with an empty stylesheet, so no font file is requested and the pages use the fallback fonts. Do not assert on the Inter or JetBrains Mono font faces.
- Any other off-app request is blocked, and its console error (`net::ERR_BLOCKED_BY_CLIENT`) fails the test every time. If the app starts loading something new from the internet, either stub it in `stayOffline` in `fixtures.ts` or serve it from the app.
- Requests to the app itself are never routed by the fixture: their failures stay visible.

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

### 8. Never `waitForTimeout`: wait for a sign the page is done

A fixed sleep is too short on a slow runner and wasted time on a fast one, so `frontend/tests/` has none. Wait on what the page shows with a web-first assertion (`await expect(locator).toHaveText(...)`). It retries until it holds.

When the expected outcome is that nothing changes (a late response must be ignored), an assertion that passes at once proves nothing. First wait for a sign that the page has handled the event, then assert. `manual-update-check.spec.ts` ("a slow page-load status…") shows how: an init script wraps `fetch`, and once the page has read that response's JSON it marks `<html>` after three hops: a 0 ms timer, then an animation frame, then a `MessageChannel` message. The page queues its re-render in the microtasks that follow the JSON, so each hop runs after the matching kind of render: a microtask re-render (Arrow), a frame callback, or a posted-message task (React's scheduler). The spec waits for the mark, then checks the screen.

The mark is not a proof for every scheduler: a render behind a longer timer, or a time-sliced render (`startTransition`) that yields, could still land after it. So whenever the code under such a test changes framework or scheduling, break the behaviour by hand (for this spec, remove the `checkStarted` guard in `UpdateCheck`) and confirm the test fails before trusting it.

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

Exit code is 0 on pass, non-zero on fail — used as-is by the `test-frontend` job in CI (`.github/workflows/pipeline.yml`).
