# Equipments

Two screens: the **list** of all equipments, and the **detail** of a single equipment.

## Equipments list

### Purpose
Browse, find, and create equipments. Get an at-a-glance status of each.

### Layout
- A grid/list of **cards**, one per equipment.
- A prominent **"+ Add equipment"** button (top-right on desktop, floating action button on mobile).

### Card content
- **Equipment picture** shown as a small avatar/thumbnail in the top-left corner of the card. Fallback when no picture is set: 🔧 emoji.
- **Equipment name** (large, primary).
- **Description** (optional, truncated to 1–2 lines).
- **Hour-meter** value (only if the equipment tracks hours, e.g. *"1 245 h"*) + the **last hour-meter update** as relative time (e.g. *"updated 3 days ago"*, *"never updated"*). Stale updates (older than the configured threshold) are visually emphasized.
- **Last intervention**: date + task name (e.g. *"Last: Oil change, 12 Apr 2026"*). If none, show *"No intervention yet"*.
- **Next due**: the most urgent upcoming task with its urgency indicator (color + relative time). If none, show *"All tasks OK"*.
- Clicking a card → navigates to the equipment detail screen.

### Empty state
Friendly message: *"No equipments yet."* + a prominent **"+ Add your first equipment"** button.

## Equipment detail

### Header (always visible)
- **Equipment picture** shown prominently on the left side of the header. Fallback: 🔧 emoji. Tapping the picture opens the upload/replace flow.
- Equipment name.
- Edit / delete actions.
- Hour-meter value + last update relative time (e.g. *"1 245 h • updated 3 days ago"*) + **"Update hours"** action. Only if the equipment tracks hours. Stale values are emphasized.

### Tabs

The detail screen has four tabs:

1. **Tasks** — The maintenance program of this equipment. See [tasks.md](./tasks.md).
2. **History** — All interventions performed on this equipment, most recent first.
3. **Documents** — Files attached to this equipment (manuals, invoices, warranties). See below.
4. **Info** — Editable equipment metadata: name, description, date of commissioning, `tracks_hours` toggle.

The Tasks tab is the default when opening an equipment.

### Documents tab

Lists all documents attached to this equipment. Each row shows: filename, size, upload date, a **Download** link, and a **Delete** action.

A **"+ Upload document"** button opens a file picker. Any file type is accepted.

Empty state: *"No documents attached."* + **"+ Upload your first document"** CTA.

## User flows

### Flow: Add an equipment
1. User taps **"+ Add equipment"** on the list.
2. A form opens (modal or full screen on mobile) with fields:
   - Name (required)
   - Description (optional)
   - Date of commissioning (optional, date picker)
   - Toggle: *"This equipment has an hour-meter"* (`tracks_hours`)
   - If toggled on: initial hours value (defaults to 0)
3. User saves.
4. New equipment appears in the list; user can be redirected to its detail screen.

### Flow: Update hour-meter
The same flow is reachable from three places: the equipment detail header, the dashboard freshness banner, and (indirectly) when logging an intervention.

1. User taps **"Update hours"**.
2. A small form asks for the new hours value (must be ≥ current).
3. On save:
   - The equipment's `hours` is updated.
   - If the new value is strictly greater than the previous one, `hours_updated_at` is set to "now". Setting the same value does **not** reset the freshness timestamp.
   - Any hour-based task statuses are recomputed.

### Flow: Toggle hour-meter on an existing equipment
1. User goes to the Info tab.
2. Turning `tracks_hours` on: a hours field appears, user sets initial value.
3. Turning `tracks_hours` off: the app warns that any task using `hours_interval` will be affected. Confirmation required.

### Flow: Upload or replace equipment picture
1. User taps the picture area in the equipment detail header (or a dedicated "Change picture" action).
2. A file picker opens — image files only.
3. On selection, the picture is uploaded and the old one is replaced immediately.
4. A **"Remove picture"** action (visible next to the picture when one is set) deletes it and restores the 🔧 fallback.

### Flow: Upload a document
1. User goes to the **Documents** tab.
2. Taps **"+ Upload document"**.
3. File picker opens — any file type.
4. The file uploads and appears in the list with its upload date.

### Flow: Delete a document
1. User taps the **Delete** action on a document row.
2. Confirmation: *"Delete this file?"*
3. On confirm, file is removed from disk and the row disappears.

### Flow: Delete an equipment
1. User taps the delete action in the equipment detail header.
2. Confirmation modal: warns that all tasks, interventions, and attached files of this equipment will be deleted.
3. On confirm, equipment and all its files are removed and user is returned to the list.

## Layout sketches

### List
```
+------------------------------------------------------+
|  Equipments                         [+ Add equipment]|
+------------------------------------------------------+
|                                                      |
|  +----------------+  +----------------+              |
|  |[🔧] Main Engine|  |[🔧] Family Car |              |
|  | 1 245 h        |  |                |              |
|  | upd. 2 mo ago  |  |                |              |
|  | Last: Oil ch.  |  | Last: —        |              |
|  | 🔴 Oil overdue |  | 🟢 All ok     |              |
|  +----------------+  +----------------+              |
|                                                      |
+------------------------------------------------------+
```

### Detail
```
+------------------------------------------------------+
|  ← [🔧] Main Engine         [Update hours] [⋯ Edit] |
|       1 245 h • updated 3 days ago                   |
+------------------------------------------------------+
|  [ Tasks ]  [ History ]  [ Documents ]  [ Info ]     |
+------------------------------------------------------+
|                                                      |
|              < tab content >                         |
|                                                      |
+------------------------------------------------------+
```

### Documents tab
```
+------------------------------------------------------+
|  ← [🔧] Main Engine                       [⋯ Edit]  |
+------------------------------------------------------+
|  Tasks  History  [ Documents ]  Info                 |
+------------------------------------------------------+
|                               [+ Upload document]    |
|  abc123.pdf     1.2 MB   12 Apr 2026  [↓] [Delete]  |
|  def456.pdf     4.7 MB   03 Jan 2026  [↓] [Delete]  |
+------------------------------------------------------+
```
