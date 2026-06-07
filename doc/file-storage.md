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

### `equipment_files` — documents attached to an equipment

| Column | Type | Notes |
|--------|------|-------|
| `equipment_id` | INTEGER | FK → equipment.id |
| `file_path` | TEXT PK | Relative path (e.g. `files/equipments/12/files/abc123.pdf`) |
| `original_name` | TEXT | Filename as uploaded by the user (e.g. `manual.pdf`). Used for display and download. |
| `uploaded_at` | TIMESTAMP | |

### `task_files` — photos attached to a task

| Column | Type | Notes |
|--------|------|-------|
| `task_id` | INTEGER | FK → tasks.id |
| `file_path` | TEXT PK | Relative path (e.g. `files/equipments/12/tasks/7/abc123.jpg`) |
| `original_name` | TEXT | Filename as uploaded by the user. |
| `uploaded_at` | TIMESTAMP | |

### `intervention_files` — photos attached to an intervention

| Column | Type | Notes |
|--------|------|-------|
| `intervention_id` | INTEGER | FK → interventions.id |
| `file_path` | TEXT PK | Relative path (e.g. `files/equipments/12/interventions/42/abc123.jpg`) |
| `original_name` | TEXT | Filename as uploaded by the user. |
| `uploaded_at` | TIMESTAMP | |

## API endpoints

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

Interventions are a flat resource in the API (`/interventions/{id}`), so their
photo endpoints are nested directly under the intervention — not under the
equipment. This deliberately leaves room for interventions that are **not bound
to an equipment** one day (e.g. a standalone log entry); the URL would stay
valid even if the equipment link were dropped. The on-disk layout still groups
the files under the owning equipment today, resolved server-side from the
intervention.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/interventions/{id}/files` | List all photos for this intervention. |
| `POST` | `/api/interventions/{id}/files` | Upload a photo. |
| `GET` | `/api/interventions/{id}/files/{filename}` | Serve a photo. |
| `DELETE` | `/api/interventions/{id}/files/{filename}` | Delete a photo. |

The `{filename}` path segment in the serve/delete endpoints is always the **stored UUID filename** (e.g. `abc123.pdf`), not the user's original name. The original name is carried in the `File` object's `original_name` field (see below), never in the URL.

## Validation & limits

Uploads are validated server-side before anything is written to disk. Limits are fixed defaults for now; they may later be promoted to `config.yaml` keys.

| Kind | Allowed types | Max size |
|------|---------------|----------|
| Task / intervention photos (#25, #26) | `image/jpeg`, `image/png`, `image/webp`, `image/gif` | 10 MB |
| Equipment documents (#3) | any type | 25 MB |

Rules:

- **Content sniffing, not extension trust.** The MIME type used for the allowlist check is detected from the file's leading bytes (Go's `http.DetectContentType`), not from the supplied filename. The stored extension is derived from the detected type for images, and from the original filename for documents.
- **Size** is enforced from the request `Content-Length` and again while streaming, so a lying header cannot exceed the cap.
- **Rejections** return a problem response: `413 Payload Too Large` when over the size cap, `415 Unsupported Media Type` when the detected type is not allowed. No file or DB row is created on rejection.

## Response shapes

### `File` object

Every list and upload response returns one or more `File` objects:

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Stored UUID filename, used as the `{filename}` URL segment (e.g. `abc123.pdf`). |
| `original_name` | string | Filename as uploaded (e.g. `manual.pdf`). |
| `size` | integer | Size in bytes. |
| `mime_type` | string | Detected MIME type. |
| `uploaded_at` | string (date-time) | ISO 8601 timestamp. |
| `url` | string | Relative serve URL for the file. |

### List endpoints

`GET …/files` returns a JSON array of `File` objects (empty array when none). `POST …/files` returns the single created `File` object with `201 Created`. Serving a missing file returns `404 Not Found`.

## File lifecycle

### Upload

1. Validate the parent entity exists.
2. Validate type and size (see [Validation & limits](#validation--limits)); reject before writing on failure.
3. Generate a UUID filename. The extension comes from the detected MIME type for images, or the original filename for documents.
4. Write the file to its target path on disk.
5. Insert a row in the appropriate DB table, recording `original_name`.

### Serve

Read the file path from the DB, stream the file from disk with `Content-Type` set to the stored MIME type. Documents are served with `Content-Disposition: attachment; filename="<original_name>"` so downloads keep their original name; images are served inline so they can be displayed.

### Delete

1. Delete the DB row.
2. Delete the file from disk. Log on failure, do not abort.

### Entity deletion cascade

When an equipment, task, or intervention is deleted:

1. Query all `_files` rows for that entity.
2. Delete each file from disk.
3. Delete the entity and its `_files` rows.

For equipment deletion: remove the entire `files/equipments/{id}/` directory tree.

### Startup orphan cleanup

On every startup, after migrations:

1. Walk the `files/` directory tree.
2. For each file found, check if a corresponding DB row exists.
3. Remove any file with no matching DB reference.

This recovers from partially failed deletes.

## Backup impact

The existing backup copies only `maintenance.db`. It must be extended to also archive the `files/` directory. The backup should produce a timestamped archive containing both the database and the files tree (e.g. `maintenance.20260101-120000.tar.gz`).
