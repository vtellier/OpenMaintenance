# 2. A missing value makes a task incomplete, not overdue

Date: 2026-10-30 · Issue #103 · Status: proposed

## Context

A task whose due point depends on a value only the user can give (an expiry task with no expiry date, a months task never done on an equipment without a commissioning date) has no due date. Until now it was reported **overdue**, so the app never claimed it was fine. But "overdue" reads as "late" when it really means "unknown", and it ranked such tasks among the truly late ones.

## Decision

Such a task gets its own due status, **incomplete** (`due_status = incomplete`), which replaces "overdue with no date". It ranks after overdue and before due soon. An equipment missing such a value, including an hour-meter reading, is shown as incomplete wherever it is listed.

## Alternatives considered

- **Keep it overdue** (the previous rule). Rejected: it reads as "late" when it means "unknown".
- **Show incomplete alongside overdue** (a flag next to the status). Rejected by the maintainer in the issue's triage: the task is reported incomplete and is no longer overdue.
- **Another place in the ranking** (above overdue, or with the OK tasks). The maintainer chose between overdue and due soon.

## Consequences

- `due_status` gains a fourth value; every client that ranks or colours tasks must handle it.
- A never-done months task with no commissioning date stops being overdue; it can still be overdue through its hours rule.
- Equipment responses gain a computed `incomplete` flag.
