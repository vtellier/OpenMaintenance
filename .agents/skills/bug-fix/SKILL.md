---
name: bug-fix
description: Entry point for fixing any bug in OpenMaintenance. Enforces the full workflow: GitHub issue → reproduce → failing test → fix → PR.
---

# Bug fix workflow

Load this skill at the start of every bug fix session. Do not write any code until all pre-fix steps are complete.

## Step 1 — GitHub issue

Confirm a GitHub issue exists for this bug. If not, create one before proceeding.

The issue number will be used for the branch name: `fix/issue-N-short-slug`.

## Step 2 — Read the spec

Read the GUI spec for the affected screen (`doc/gui/`). Confirm the behaviour is actually a bug and not the intended design. If it matches the spec, it is not a bug — clarify with the user before continuing.

## Step 3 — Reproduce

Reproduce the bug with Chrome DevTools MCP. Do not rely on a verbal description alone — observe it yourself.

## Step 4 — Write the failing test (before any fix)

Load the non-regression-test skill: `.agents/skills/non-regression-test/SKILL.md`

Write a Playwright spec in `frontend/tests/non-regression/` that:
- reproduces the exact bug you just observed
- **fails on the current (unfixed) code**

Run `pnpm test` from `frontend/` and confirm the new spec fails for the right reason. Do not proceed until it does.

## Step 5 — Apply the fix

Now implement the fix. Keep it scoped — do not refactor or clean up unrelated code.

## Step 6 — Verify

Run `pnpm test` from `frontend/`. The new spec must pass. All existing specs must still pass.

Run `make build` from the repo root to confirm no build regressions.

## Step 7 — Commit and PR

- One commit for the failing test, one commit for the fix (or a single combined commit if they are trivial — ask the user).
- Open a PR referencing the issue (`Closes #N`).
- Always ask for confirmation before running any `gh` command.
