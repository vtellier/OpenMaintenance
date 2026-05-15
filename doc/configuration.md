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
```

## Fields

| Key | Default | Description |
|-----|---------|-------------|
| `server.port` | `3001` | TCP port the HTTP server listens on |
| `database.path` | `./maintenance.db` | Path to the SQLite database file. Relative paths are resolved from the binary's directory |

## Behaviour

- If `config.yaml` is missing: created automatically with defaults, then startup continues normally.
- If a field is missing from an existing file: the default value is used for that field.
- Invalid values (e.g. non-integer port): startup fails with a clear error message.
