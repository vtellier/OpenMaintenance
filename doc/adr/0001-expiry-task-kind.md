# 1. Expiry tasks are a separate task kind, fixed at creation

Date: 2026-10-19 · Issue #99

## Context

Some parts carry a printed expiry date rather than a service interval (a life jacket's CO2 cartridge). Their next replacement is only known once the new part is fitted, and falls on a fixed date. Interval tasks are counted in months and/or hours from when they were last done, which cannot predict it.

## Decision

An **expiry task** is a separate kind of task (`kind = expiry`), next to the **interval task** (`kind = interval`). It has no months or hours interval; each intervention on it records the new part's expiry date, and the task is due on the latest one. The kind is chosen when the task is created and cannot be changed.

## Alternatives considered

- **A third trigger beside months and hours** on the same task. Rejected: a task could then mix an expiry date with intervals, and every rule that combines triggers (worse status, driving trigger, greater fraction) would need a meaning for it. The issue found no use for the mix.
- **A kind that can be changed later.** Rejected: the history of one kind says nothing about the other (an interval task's interventions carry no expiry date), so the due status after a switch would rest on missing data.
- **A Part entity.** Rejected: the task already stands for the part; a separate entity adds screens without a use.

## Consequences

- `due_trigger` gains the value `expiry`, and clients render its timing text.
- The intervention forms show a required expiry date field for expiry tasks only.
- Converting a task means deleting it and creating one of the other kind.
