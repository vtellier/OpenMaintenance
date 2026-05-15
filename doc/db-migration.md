# Database Migrations

OpenMaintenance stores its data in a single SQLite file. Across releases the schema can evolve, so the database carries its own version stamp. On startup the backend compares that stamp to the version the running binary expects, and applies any pending migrations.

## The `meta` table

```sql
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

Two keys are managed by the backend:

| Key              | Type    | Meaning                                                                 |
|------------------|---------|-------------------------------------------------------------------------|
| `schema_version` | integer | Monotonic counter. Bumped each time a migration is added in the code.   |
| `app_version`    | string  | Last binary that opened this DB, e.g. `v0.1.0-3-gabcdef`. Diagnostic.   |

Additional single-row metadata (install date, instance id, etc.) can be added later as extra keys without a schema change.

## `schema_version` semantics

- The schema produced by the very first release of OpenMaintenance is **version 1**.
- Each subsequent schema change adds a migration numbered `2, 3, 4, …`. The number that the current binary knows about is its **target version**.
- A migration is a SQL statement (or short sequence of statements) that takes the schema from version `N-1` to version `N`.
- Migrations are **forward-only**. There is no automatic downgrade.

## Startup flow

On every backend startup, after opening the SQLite file:

1. **Ensure `meta` exists.** Create the table if missing.
2. **Bootstrap `schema_version`.** If `schema_version` is absent:
   - If the legacy domain tables (`equipments`, `tasks`, `interventions`) already exist → assume the DB is at version 1 (existing install pre-dating this mechanism).
   - Otherwise (fresh install) → create the current schema directly and set `schema_version` to the binary's target version.
3. **Apply pending migrations.** For each known migration with number > current `schema_version`, run it in a transaction and update `schema_version` to that number on success.
4. **Detect future DBs.** If current `schema_version` > the binary's target version, log the mismatch and refuse to start — running an older binary against a newer DB risks data corruption.
5. **Record `app_version`.** Write the running binary's version string into `meta.app_version`.

Steps 2–4 happen before any handler is registered, so a failure is fatal and visible in the logs.

## Adding a new migration

When a schema change is required:

1. Bump the target version constant in `backend/internal/db/` (the value the running binary expects).
2. Append a migration entry: `{Version: N, SQL: "ALTER TABLE …"}`.
3. Update `data-model.md` if the domain shape changed.
4. Test the upgrade path by running the new binary against a copy of a pre-migration DB.

Migrations must be idempotent enough to survive a crash between the SQL executing and the `schema_version` update — prefer `IF NOT EXISTS` / `IF EXISTS` clauses where SQLite supports them, or write the migration so re-running it is a no-op.

## What does **not** trigger a migration

- Adding a new release tag with no schema change. `app_version` is updated but `schema_version` is unchanged.
- Changes confined to indexes for performance (acceptable to run unconditionally on every startup, outside the migration list).
