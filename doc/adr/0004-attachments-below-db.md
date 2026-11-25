# 4. The attachments module sits below `db` and owns its tables

Date: 2026-11-25 · Issue #127

## Context

The rules for attachments (equipment documents, intervention photos) were spread over the handlers, `db` and `filestore`, with documents and photos copied almost line for line, and the copies had started to drift (#119). They move into one module.

`db` needs part of those rules before any handler exists: `InitDB` refuses to start when none of the referenced files is found (#121), and the startup backup skips rotation when its archive is incomplete (#123). Both run the referenced-files check.

## Decision

`internal/attachments` sits **below** `db`: it imports neither `db` nor `handlers`. It owns the SQL of `equipment_files` and `intervention_files` and the bytes under `files/`. Their migrations stay in `db` with the others.

`db` calls into it from its startup check, its backup, and its equipment, task and intervention delete functions. Anything that needs another table is handed in by the caller: whether the owner exists, which equipment an intervention belongs to, and the save of the intervention during a move.

## Alternatives considered

- **Above `db`, importing it.** Rejected: the referenced-files check would have to stay in `db`, apart from the rest of the rules, or startup and the backup would have to leave `db`.
- **The attachment SQL stays in `db`**, like every other table's. Rejected: the rows and the bytes change together (upload, delete, move, cascade). Keeping them in two packages is what let the two kinds drift.
- **Handlers delete an owner's attachments around each `db` delete**, as three handlers did. Rejected: every delete path would have to remember it.

## Consequences

- `db` is no longer the only package that holds SQL. Migrations still all live in `db`.
- The move takes the save of the intervention from its caller, since the module cannot import `db`.
- `filestore` keeps only where the data lives: the database path and the `files/` directory beside it.
