# File Storage

## Approach

Files are stored on disk in a `files/` directory alongside the SQLite database. The database does not store file content — only a reference to the file path. File metadata (size, MIME type) is read from the file at serve time.

This keeps the database lean, backup simple (archive the directory containing both the `.db` and `files/`), and avoids BLOB performance issues.

## Directory location

The `files/` directory lives in the same directory as the database file. There is no configuration key — it is always derived from `database.path`.

| `database.path` | Files directory |
|-----------------|-----------------|
| `./maintenance.db` | `./files/` |
| `/data/maintenance.db` | `/data/files/` |
| `./data/maintenance.db` | `./data/files/` |

The backend creates the directory on startup if it does not exist.

## Filesystem layout

Files are organised under the equipment they belong to, even for tasks and interventions (which are always children of an equipment). This keeps all data for one equipment together.

```
files/
  equipments/
    {equipment_id}/
      picture.{ext}                         ← one profile picture per equipment
      files/
        {uuid}.{ext}                        ← equipment documents
      tasks/
        {task_id}/
          {uuid}.{ext}                      ← task photos
      interventions/
        {intervention_id}/
          {uuid}.{ext}                      ← intervention photos
```

Files are stored under a generated UUID to avoid collisions and path special-character issues.

## Database schema additions

### `equipment` table — new column

| Column | Type | Notes |
|--------|------|-------|
| `picture` | TEXT | Relative path to the picture file (e.g. `files/equipments/12/picture.jpg`). NULL when no picture is set. |

### `equipment_files` — documents attached to an equipment

| Column | Type | Notes |
|--------|------|-------|
| `equipment_id` | INTEGER | FK → equipment.id |
| `file_path` | TEXT PK | Relative path (e.g. `files/equipments/12/files/abc123.pdf`) |
| `uploaded_at` | TIMESTAMP | |

### `task_files` — photos attached to a task

| Column | Type | Notes |
|--------|------|-------|
| `task_id` | INTEGER | FK → tasks.id |
| `file_path` | TEXT PK | Relative path (e.g. `files/equipments/12/tasks/7/abc123.jpg`) |
| `uploaded_at` | TIMESTAMP | |

### `intervention_files` — photos attached to an intervention

| Column | Type | Notes |
|--------|------|-------|
| `intervention_id` | INTEGER | FK → interventions.id |
| `file_path` | TEXT PK | Relative path (e.g. `files/equipments/12/interventions/42/abc123.jpg`) |
| `uploaded_at` | TIMESTAMP | |

## API endpoints

### Equipment picture (issue #2)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/equipment/{id}/picture` | Upload or replace the profile picture. |
| `GET` | `/api/equipment/{id}/picture` | Serve the picture. Returns 404 if none. |
| `DELETE` | `/api/equipment/{id}/picture` | Delete the picture. |

### Equipment documents (issue #3)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/equipment/{id}/files` | List all documents. |
| `POST` | `/api/equipment/{id}/files` | Upload a document. |
| `GET` | `/api/equipment/{id}/files/{filename}` | Serve a document. |
| `DELETE` | `/api/equipment/{id}/files/{filename}` | Delete a document. |

### Task photos (issue #26)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/equipment/{id}/tasks/{task_id}/files` | List all photos for this task. |
| `POST` | `/api/equipment/{id}/tasks/{task_id}/files` | Upload a photo. |
| `GET` | `/api/equipment/{id}/tasks/{task_id}/files/{filename}` | Serve a photo. |
| `DELETE` | `/api/equipment/{id}/tasks/{task_id}/files/{filename}` | Delete a photo. |

### Intervention photos (issue #25)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/equipment/{id}/interventions/{intervention_id}/files` | List all photos for this intervention. |
| `POST` | `/api/equipment/{id}/interventions/{intervention_id}/files` | Upload a photo. |
| `GET` | `/api/equipment/{id}/interventions/{intervention_id}/files/{filename}` | Serve a photo. |
| `DELETE` | `/api/equipment/{id}/interventions/{intervention_id}/files/{filename}` | Delete a photo. |

## File lifecycle

### Upload

1. Validate the parent entity exists.
2. Generate a UUID filename, preserving the original file extension.
3. Write the file to its target path on disk.
4. Insert a row in the appropriate DB table (or update `equipment.picture` for the profile picture).

For equipment picture: if a picture already exists, delete the old file from disk first, then write the new one and update the `picture` column.

### Serve

Read the file path from the DB, stream the file from disk with `Content-Type` derived from the file extension.

### Delete

1. Delete the DB row (or set `equipment.picture` to NULL).
2. Delete the file from disk. Log on failure, do not abort.

### Entity deletion cascade

When an equipment, task, or intervention is deleted:

1. Query all `_files` rows for that entity.
2. Delete each file from disk.
3. Delete the entity and its `_files` rows.

For equipment deletion: also delete the picture file if present, then remove the entire `files/equipments/{id}/` directory tree.

### Startup orphan cleanup

On every startup, after migrations:

1. Walk the `files/` directory tree.
2. For each file found, check if a corresponding DB row (or `equipment.picture` value) exists.
3. Remove any file with no matching DB reference.

This recovers from partially failed deletes.

## Backup impact

The existing backup copies only `maintenance.db`. It must be extended to also archive the `files/` directory. The backup should produce a timestamped archive containing both the database and the files tree (e.g. `maintenance.20260101-120000.tar.gz`).
