# Equipments

Two screens: the **list** of all equipments, and the **detail** of a single equipment.

## Equipments list

### Purpose
Browse, find, and create equipments. Get an at-a-glance status of each.

### Layout
- A grid/list of **cards**, one per equipment.
- A prominent **"+ Add equipment"** button (top-right on desktop, floating action button on mobile).

### Card content
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
- Equipment name.
- Edit / delete actions.
- Hour-meter value + last update relative time (e.g. *"1 245 h • updated 3 days ago"*) + **"Update hours"** action. Only if the equipment tracks hours. Stale values are emphasized.

### Tabs

The detail screen has three tabs:

1. **Tasks** — The maintenance program of this equipment. See [tasks.md](./tasks.md).
2. **History** — All interventions performed on this equipment, most recent first.
3. **Info** — Editable equipment metadata: name, description, `tracks_hours` toggle.

The Tasks tab is the default when opening an equipment.

## User flows

### Flow: Add an equipment
1. User taps **"+ Add equipment"** on the list.
2. A form opens (modal or full screen on mobile) with fields:
   - Name (required)
   - Description (optional)
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

### Flow: Delete an equipment
1. User taps the delete action in the equipment detail header.
2. Confirmation modal: warns that all tasks and interventions of this equipment will be deleted.
3. On confirm, equipment is removed and user is returned to the list.

## Layout sketches

### List
```
+------------------------------------------------------+
|  Equipments                         [+ Add equipment]|
+------------------------------------------------------+
|                                                      |
|  +----------------+  +----------------+              |
|  | Main Engine    |  | Family Car     |              |
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
|  ← Main Engine               [Update hours] [⋯ Edit] |
|  1 245 h • updated 3 days ago                        |
+------------------------------------------------------+
|  [ Tasks ]  [ History ]  [ Info ]                    |
+------------------------------------------------------+
|                                                      |
|              < tab content >                         |
|                                                      |
+------------------------------------------------------+
```
