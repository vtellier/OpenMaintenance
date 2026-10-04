# Deployment Configuration

Operator-facing configuration for the deployed binary. Not a user feature.

## Mechanism

At startup, the backend looks for `config.yaml` in the same directory as the binary. If the file does not exist, it is automatically created with all default values.

## config.yaml

```yaml
# OpenMaintenance configuration
# This file is auto-created with defaults if missing.

server:
  port: 3001          # TCP port the HTTP server listens on

database:
  path: ./maintenance.db  # Path to the SQLite file (relative to the binary or absolute)

backup:
  enabled: true         # Set to false to disable automatic backups
  path: ./backups       # Directory for backup files (relative to the binary or absolute)
  keep: 7               # Number of backups to retain (0 = unlimited)
```

## Fields

| Key | Default | Description |
|-----|---------|-------------|
| `server.port` | `3001` | TCP port the HTTP server listens on |
| `database.path` | `./maintenance.db` | Path to the SQLite database file. Relative paths are resolved from the binary's directory |
| `backup.enabled` | `true` | Take a backup on every startup (see [Backups](#backups)) |
| `backup.path` | `./backups` | Directory where backups are written. Relative paths are resolved from the binary's directory |
| `backup.keep` | `7` | Number of backups to retain; older ones are deleted. `0` keeps them all |

## Behaviour

- If `config.yaml` is missing: created automatically with defaults, then startup continues normally.
- If a field is missing from an existing file: the default value is used for that field.
- Invalid values (e.g. non-integer port): startup fails with a clear error message.

## Backups

When `backup.enabled` is true, the backend takes one backup on every startup, before it opens the database and before any migration runs. Each backup therefore holds the state left by the previous run, and an upgrade can always be rolled back to the pre-migration data.

- **Format**: one gzip-compressed tar archive per startup, written to `backup.path` and named `<db-stem>.<YYYYMMDD-HHMMSS>.tar.gz` in the server's local time (e.g. `maintenance.20260101-120000.tar.gz`).
- **Contents**: the database file, under its own file name (e.g. `maintenance.db`), and the `files/` tree of attached files (see [file-storage.md](./file-storage.md)). Paths in the archive are relative to the database directory, so extracting it there puts everything back in place. Only regular files and directories are archived (anything else under `files/` is skipped with a log line); `files/` itself may be a symlink (e.g. to another volume), its target is archived.
- **No attachments yet**: a missing `files/` directory is fine; the archive then holds only the database.
- **First run**: when the database file does not exist yet, nothing is backed up.
- **Consistency**: the database is copied with SQLite's `VACUUM INTO`, which produces a clean, self-contained copy even if the previous run was killed in the middle of a write. Because the backup runs before the server starts, nothing can change the database or the files while the archive is written. The archive is built under a temporary name and renamed once complete, so an interrupted backup never leaves a truncated `.tar.gz` behind.
- **Disk space**: while it runs, a backup temporarily needs room for a copy of the database next to the archive being written, both in `backup.path`. Archives include every attached file, so size `backup.keep` accordingly.
- **Rotation**: after a successful backup, only the `backup.keep` most recent backups are kept (ordered by the timestamp in their name); older ones are deleted. `0` keeps everything. Only files named exactly `<db-stem>.<YYYYMMDD-HHMMSS>.tar.gz` or `.bak` are ever deleted. An old backup that cannot be deleted is logged and does not block startup.
- **Failure**: if the backup cannot be written, startup aborts with an error instead of continuing (and migrating) without a backup.

### Legacy `.bak` backups

Older releases stored each backup as a plain copy of the database, `<db-stem>.<YYYYMMDD-HHMMSS>.bak`, without the attached files. They are **not** deleted on upgrade:

- They count toward `backup.keep` together with the new archives. Being the oldest, they are the first to go as new archives are created, exactly as they would have been rotated out before the format changed. With `keep: 0` they are never deleted.
- The Settings page lists them alongside the archives.

### Restoring a backup

There is no restore button; restoring is a manual operator task:

1. Stop OpenMaintenance.
2. Move the current database file and `files/` directory aside.
3. Extract the archive into the database directory, e.g. `tar -xzf backups/maintenance.20260101-120000.tar.gz -C /path/to/db-dir`.
4. Start OpenMaintenance. Migrations bring an older database up to date.

A legacy `.bak` file is restored by copying it to the database path (e.g. `maintenance.db`); it holds no attached files.
