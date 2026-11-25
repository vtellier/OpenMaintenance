# File Storage

## Approach

Files are stored on disk in a `files/` directory alongside the SQLite database. The database does not store file content — only a reference to the file path. File metadata (size, MIME type) is read from the file at serve time.

This keeps the database lean, backup simple (archive the directory containing both the `.db` and `files/`), and avoids BLOB performance issues.

## The attachments module

Every rule on this page lives in one module, `backend/internal/attachments` (#127, [ADR 0004](./adr/0004-attachments-below-db.md)). It owns the attachment tables (`equipment_files`, `intervention_files`) and the bytes under `files/`: no other code reads or writes either. Their migrations stay with the others in `db`.

- **Kinds.** A document and a photo are two kinds of attachment that differ only by data: their table and owner column, their directory, their cap, the types they allow, and whether they are served as a download or inline.
- **Owners.** Callers name whose attachments they mean: the documents of an equipment, or the photos of an intervention, with the ids its directory needs. The caller checks first that the owner exists; the module knows only its own tables.
- **What it does.** Store an upload, list attachments (with `missing`), give what is needed to serve one, delete one, count photos, delete everything an owner has, move an intervention's photos to another equipment, and check the referenced files at startup and for the backup.
- **What stays outside.** URLs and the API's `File` object belong to the handlers, so a photo's URL does not depend on where its bytes are. Where the data lives (the database path and the directory beside it) belongs to `filestore`.
- **Refusals** carry their reason, built from the kind's cap and allowed types, so the message cannot drift from the rule. Handlers map them to `413`, `415` or `404`.

## Directory location

The `files/` directory lives in the same directory as the database file. There is no configuration key — it is always derived from `database.path`.

| `database.path` | Files directory |
|-----------------|-----------------|
| `./maintenance.db` | `./files/` |
| `/data/maintenance.db` | `/data/files/` |
| `./data/maintenance.db` | `./data/files/` |

The backend creates the directory on startup if it does not exist.

The database and its `files/` directory always travel together: moving one without the other is caught by the [startup check](#startup-check-for-missing-files). See [configuration.md — Moving your data](./configuration.md#moving-your-data).

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

> Not implemented yet (#26).

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
| `GET` | `/api/equipments/{id}/files` | List all documents. |
| `POST` | `/api/equipments/{id}/files` | Upload a document. |
| `GET` | `/api/equipments/{id}/files/{filename}` | Serve a document. |
| `DELETE` | `/api/equipments/{id}/files/{filename}` | Delete a document. |

### Task photos (issue #26)

> Not implemented yet (#26). In the attachments module they would be a third kind, owned by a task.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/equipments/{id}/tasks/{task_id}/files` | List all photos for this task. |
| `POST` | `/api/equipments/{id}/tasks/{task_id}/files` | Upload a photo. |
| `GET` | `/api/equipments/{id}/tasks/{task_id}/files/{filename}` | Serve a photo. |
| `DELETE` | `/api/equipments/{id}/tasks/{task_id}/files/{filename}` | Delete a photo. |

### Intervention photos (issue #25)

Interventions are a flat resource in the API (`/interventions/{id}`), so their
photo endpoints are nested directly under the intervention — not under the
equipment. This deliberately leaves room for interventions that are **not bound
to an equipment** one day (e.g. a standalone log entry); the URL would stay
valid even if the equipment link were dropped. The on-disk layout still groups
the files under the owning equipment today, resolved server-side from the
intervention. For the same reason the URLs do not change when an intervention
moves to another equipment (see [Move](#move-intervention-changes-equipment)).

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
| Equipment documents (#3, #119) | any type | 50 MB |

Rules:

- **Content sniffing, not extension trust.** The MIME type used for the allowlist check is detected from the file's leading bytes (Go's `http.DetectContentType`), not from the supplied filename. The stored extension is derived from the detected type for images, and from the original filename for documents.
- **Size** is enforced from the request `Content-Length` and again while streaming, so a lying header cannot exceed the cap.
- **Rejections** return `413 Payload Too Large` when over the size cap, `415 Unsupported Media Type` when the detected type is not allowed. The body is `{"error": "<reason>"}`, and the reason states the limit that was broken: `file exceeds the 50 MB limit` for a document, `file exceeds the 10 MB limit` for a photo. The number comes from the cap itself, so the message cannot drift from it. No file or DB row is created on rejection.

## Response shapes

### `File` object

Every list and upload response returns one or more `File` objects:

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Stored UUID filename, used as the `{filename}` URL segment (e.g. `abc123.pdf`). |
| `original_name` | string | Filename as uploaded (e.g. `manual.pdf`). |
| `size` | integer | Size in bytes, read from disk; `0` when `missing`. |
| `mime_type` | string | Detected MIME type. |
| `uploaded_at` | string (date-time) | ISO 8601 timestamp. |
| `url` | string | Relative serve URL for the file. |
| `missing` | boolean | `true` when the file is absent from disk (its row exists, the file does not), `false` otherwise. The entry can still be deleted; serving it returns `404 Not Found`. |

### List endpoints

`GET …/files` returns a JSON array of `File` objects (empty array when none). `POST …/files` returns the single created `File` object with `201 Created`. Serving a missing file returns `404 Not Found`. A list keeps an entry whose file is gone from disk and flags it with `missing: true`, so the app can say so and the entry can be deleted (issue #122).

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

### Move (intervention changes equipment)

An intervention can be edited onto another equipment: moved to a task of another equipment, or, for an exceptional intervention, given another `equipment_id`. Its photos follow it, from `files/equipments/{old}/interventions/{id}/` to `files/equipments/{new}/interventions/{id}/`, and their `file_path` rows are rewritten to match.

The filesystem and the database cannot share a transaction, so the steps are ordered so that a DB row never points at a missing file, even if the process stops midway:

1. Copy each photo to the new equipment's directory and flush it to disk.
2. In one DB transaction, save the intervention and rewrite its photos' `file_path` to the copies.
3. Delete the originals and the old intervention directory. Log on failure, do not abort.

The attachments module runs the three steps. The caller hands it the save of the intervention, which runs in the step 2 transaction, since the module does not write interventions itself.

If step 1 or 2 fails, the copies are removed and the edit is rejected: the intervention and its photos stay where they were. An interruption can only leave unreferenced files behind (copies before step 2, originals after it), which [startup orphan cleanup](#startup-orphan-cleanup) recovers.

A photo whose file is already missing from disk does not block the move: there is nothing to copy, but its row is still rewritten, so it stays with its intervention and can be deleted through the API.

### Entity deletion cascade

Deleting an equipment, a task or an intervention deletes its attachments too. The `db` delete functions call the attachments module themselves, so no delete path can leave attachments behind:

1. In one DB transaction, delete the owner, everything it owns and their attachment rows: for an equipment, its tasks, all its interventions (exceptional ones included), its documents and their photos; for a task, its interventions and their photos; for an intervention, its photos.
2. Once that transaction is committed, remove the directories from disk: `files/equipments/{id}/` for an equipment, `files/equipments/{eq}/interventions/{id}/` for an intervention, and that of each of its interventions for a task. Log on failure, do not abort: the delete has succeeded, and a leftover is an unreferenced file, which [startup orphan cleanup](#startup-orphan-cleanup) recovers.

If any statement of step 1 fails, the transaction is rolled back and nothing is deleted: the owner, what it owns, the attachment rows and their files all stay as they were, and the API answers `500`.

### Startup check for missing files

On every startup, once the database file exists and **before the startup backup** (so before anything is written), the backend checks every file path referenced by `equipment_files` and `intervention_files` against the `files/` directory next to the database. A database that predates attachments, or references no file at all, passes as before.

| Referenced files found | Outcome |
|------------------------|---------|
| All of them, or nothing is referenced | Startup continues as normal. |
| Some missing | Startup continues and logs a warning with the number missing and the first few missing paths. In the app, those files show as missing on the server (`missing: true`: the Documents tab and the intervention photos say so); they cannot be downloaded until they are put back, and their entries can be deleted. |
| **None of them** | Startup is refused. No backup is written and no backup is rotated away, so a service manager restarting the app in a loop can never push good backups out. |

The refusal names the database path, the expected `files/` directory and the number of missing files, and says to move the `files/` directory next to the database. The usual cause is a `database.path` changed to a copy of the database taken without its `files/` directory.

The check lives in one place, the attachments module. The startup backup reuses it to tell whether the archive it just wrote is complete, and skips rotation when it is not (see [configuration.md — Backups](./configuration.md#backups)).

### Startup orphan cleanup

> Not implemented yet. When it is, it must follow these rules.

On startup, after migrations:

1. **Skip the cleanup entirely when the [startup check](#startup-check-for-missing-files) found any missing file.** A database that does not match its `files/` directory (for example `database.path` pointing at an older copy of the database) makes every file uploaded since that copy look like an orphan.
2. Walk the `files/` directory tree, skipping `files/.orphans/`.
3. For each file found, check if a corresponding DB row exists.
4. **Move** any file with no matching DB reference to `files/.orphans/`, keeping its path relative to `files/`. Nothing is ever deleted: the operator empties `files/.orphans/` by hand once satisfied.

This recovers from partially failed deletes and interrupted moves without ever losing a file.

## Backup impact

The startup backup archives the database **and** the `files/` tree into a single timestamped `.tar.gz` (e.g. `maintenance.20260101-120000.tar.gz`), so restoring a backup brings back the attachments together with the rows that reference them. A missing `files/` directory (no attachment uploaded yet) is fine. Format, rotation, legacy `.bak` backups and restore are described in [configuration.md — Backups](./configuration.md#backups).
