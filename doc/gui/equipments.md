# Equipments

Two screens: the **list** of all equipments, and the **detail** of a single equipment.

## Equipments list

### Purpose
Browse, find, and create equipments. Get an at-a-glance status of each.

### Layout
- One list of **group sections** and **cards**:
  - Each [group](../data-model.md#group) is a **collapsible section** holding the cards of its equipments.
  - An equipment with **no group** is a card at the same level as the sections. There is no "No group" section.
- **Order**, for now: sections and top-level cards are sorted **together, alphabetically by name**, ignoring case. When a group and an equipment have the same name, the group comes first. The cards inside a section are sorted alphabetically too. Equipments with the same name are ordered by creation (`id`). A manual order is out of scope.
- A prominent **"+ Add equipment"** button (top-right on desktop, floating action button on mobile).

### Decommissioned equipments
[Decommissioned](../data-model.md#decommissioning) equipments are **hidden** from the list by default.

- A **Show decommissioned** checkbox in the list header, with their count, e.g. *"Show decommissioned (2)"*. It is there only when at least one equipment is decommissioned.
- Checked, the decommissioned equipments are listed like the others, in their group's section or as top-level cards, in the same alphabetical order, but **dimmed** (see [Card content](#card-content)).
- Checked or not is remembered **per browser**, like collapsed sections. It starts unchecked.

### Section header
- The group's **icon** (emoji, defaults to 🗂️), its **name** and the **number of its equipments** the section shows, e.g. *"🗂️ Winches · 4"*: its decommissioned equipments count only while **Show decommissioned** is checked.
- The **worst status** among its equipments, as a badge like the ones on the cards (see [Card content](#card-content)): **Overdue** if any of its cards shows Overdue, otherwise **Due soon** if any shows Due soon, otherwise **OK** if any shows OK. No badge when none of its equipments has a task, or when the group is empty. A collapsed group therefore never hides an overdue equipment. A decommissioned equipment never adds to it: its tasks have no due status.
- A **⋯** menu with **Rename**, **Change icon** and **Delete** (see [Flow: Manage a group](#flow-manage-a-group)).
- Clicking the header, outside its menu, collapses or expands the section. A chevron shows which.
- Sections are **expanded by default**. Collapsed or expanded is remembered **per browser**, for each group; a new group starts expanded.
- An expanded empty group shows *"No equipments in this group."* One whose equipments are all decommissioned and hidden shows *"All equipments in this group are decommissioned."*

### Card content
- **Equipment icon** (emoji, defaults to 🔧) shown as a small avatar in the top-left corner of the card.
- **Equipment name** (large, primary).
- **Description** (optional, truncated to 1–2 lines).
- **Hour-meter** value (only if the equipment tracks hours, e.g. *"1 245 h"*) + the **last hour-meter update** as relative time (e.g. *"updated 3 days ago"*, *"never updated"*). Stale updates (older than the configured threshold) are visually emphasized.
- **Last intervention**: date + task name (e.g. *"Last: Oil change, 12 Apr 2026"*). If none, show *"No intervention yet"*.
- **Next due**: the most urgent upcoming task, the first in [urgency order](../data-model.md#ranking-tasks-by-urgency), with its urgency indicator (color + status label), its name and its timing text, the same timing text as the dashboard (see [dashboard.md](./dashboard.md#timing-text)), e.g. *"[Overdue] Oil change — 120 h ago"*. When several tasks have that status, their count replaces the name, followed by the most urgent one's timing text, e.g. *"[Overdue] 3 tasks — most urgent 120 h ago"*. If none, show *"All tasks OK"*.
- Clicking a card → navigates to the equipment detail screen.

A **decommissioned** equipment's card (shown only with **Show decommissioned** checked) is **dimmed**. Its **Next due** line is replaced by a **"Decommissioned"** badge and the date, e.g. *"[Decommissioned] 3 Mar 2024"*: its tasks have no due status. Its hour-meter update is never emphasized as stale. The rest of the card is unchanged.

### Empty state
When there is no equipment and no group: friendly message *"No equipments yet."* + a prominent **"+ Add your first equipment"** button. Empty groups alone are listed as sections.

When every equipment is decommissioned and hidden, and there is no group: *"No equipments in service."*, with the **Show decommissioned** checkbox.

## Equipment detail

### Header (always visible)
- **Equipment icon** (emoji, defaults to 🔧) shown on the left side, before the name. Clicking it opens the emoji picker; the change is saved immediately.
- Equipment name, followed by a **"Decommissioned"** badge when the equipment is [decommissioned](../data-model.md#decommissioning).
- Edit / delete actions.
- Hour-meter value + last update relative time (e.g. *"1 245 h • updated 3 days ago"*) + **"Update hours"** and **"Correct reading"** actions. Only if the equipment tracks hours. Stale values are emphasized.

### Tabs

The detail screen has four tabs:

1. **Tasks** — The maintenance program of this equipment; **Done** on a row opens the intervention form prefilled for that task. See [tasks.md](./tasks.md).
2. **History** — All interventions performed on this equipment, most recent first.
3. **Documents** — Files attached to this equipment (manuals, invoices, warranties). See below.
4. **Info** — Equipment metadata: name, description, date of commissioning, **date of decommissioning** (right after it, only when the equipment is decommissioned), **icon emoji**, `tracks_hours` toggle. Both dates are set from the edit form. The group is not shown here; it is set from the edit form too. The hour-meter reading is not metadata: editing the equipment never changes it or its freshness (see [data-model.md](../data-model.md#what-changes-the-reading)).

The Tasks tab is the default when opening an equipment.

### Documents tab

Lists all documents attached to this equipment. Each row shows: filename, size, upload date, a **Download** link, and a **Delete** action.

A **"+ Upload document"** button opens a file picker. Any file type is accepted, up to 50 MB.

A refused upload shows the server's reason in a red banner above the list, e.g. *"file exceeds the 50 MB limit"*. The generic *"Failed to upload document"* shows only when the response gives no reason (e.g. the server is unreachable).

A document whose file is gone from the server (see [file-storage.md](../file-storage.md), `missing`) shows *"File missing on server"* in place of its size, has no **Download** link, and keeps its **Delete** action, so the dangling entry can be removed.

Empty state: *"No documents attached."* + **"+ Upload your first document"** CTA.

## User flows

### Flow: Add an equipment
1. User taps **"+ Add equipment"** on the list.
2. A form opens (modal or full screen on mobile) with fields:
   - Name (required)
   - Description (optional)
   - **Icon** (defaults to 🔧) — chosen from an **icon picker**: a button opens a searchable emoji picker (any emoji, no text field), with a Reset to 🔧. The icon is the equipment's marker in lists and the dashboard.
   - **Group** (optional, defaults to *"No group"*): see [the Group picker](#the-group-picker).
   - Date of commissioning (optional, date picker)
   - Toggle: *"This equipment has an hour-meter"* (`tracks_hours`)
   - If toggled on: initial hours value (defaults to 0)
3. User saves. With the hour-meter on, the initial value becomes the first reading and `hours_updated_at` is set to "now".
4. New equipment appears in the list, in its group's section if it has one; user can be redirected to its detail screen.

The edit form (`/equipments/{id}/edit`) has the same **Group** picker, set to the equipment's current group. It also has a **Decommissioned on** date, right after the date of commissioning (see [Flow: Decommission an equipment](#flow-decommission-an-equipment)). The create form does not.

### The Group picker
A select labelled **Group**, in the create and edit forms:

- **"No group"**, then the groups alphabetically (icon and name), then **"+ New group"** last.
- Picking **"+ New group"** opens a small inline form under the picker: **Name** (required) and **Icon** (the same emoji picker, Reset to 🗂️), with **Create** and **Cancel**.
  - **Create** saves the group at once (`POST /groups`) and selects it in the picker. A name another group already has, ignoring case, shows *"A group with this name already exists"* and creates nothing.
  - **Cancel** closes the inline form and puts the picker back to its previous value.
- A group created this way exists even if the equipment form is then cancelled: it shows as an empty section.

Changing the icon from the detail header keeps the equipment's group and its decommissioning date.

### Flow: Decommission an equipment
For an equipment that left service (sold, removed, replaced), kept for its history.

1. User opens the edit form (`/equipments/{id}/edit`).
2. **Decommissioned on** (optional date picker, right after **Date of commissioning**). Hint: *"Set when the equipment leaves service. Its tasks are no longer due; its history is kept."*
   - It cannot be after today (the picker's maximum) nor before the date of commissioning (its minimum). Save is disabled while the date breaks either rule.
3. User saves. A date the backend refuses keeps the form open and shows its reason.
4. The equipment is decommissioned: a **"Decommissioned"** badge in the detail header, the date on the Info tab. It leaves the Dashboard and, unless **Show decommissioned** is checked, the Equipments list. Its tasks, history, documents and group are kept.

**Clearing** the date and saving puts the equipment **back in service**: its tasks are due again, computed from their history.

### Flow: Update hour-meter
The same flow is reachable from three places: the equipment detail header, the dashboard freshness banner, and (indirectly) when logging an intervention.

1. User taps **"Update hours"**.
2. A small form asks for the new hours value (must be ≥ current).
3. On save (via `PUT /equipments/{id}/hours`):
   - The equipment's `hours` is updated.
   - `hours_updated_at` is set to "now", **even when the value is unchanged** — submitting the form is an explicit freshness confirmation, so it dismisses the Dashboard reminder. (Logging an intervention keeps the stricter "only when hours increase" rule; see [data-model.md](../data-model.md).)
   - Any hour-based task statuses are recomputed.

### Flow: Correct the reading
The deliberate way to fix a wrong reading, e.g. a mistyped one, including setting it **lower**. Reachable from the equipment detail header (**"Correct reading"**) and from the question asked after deleting or editing the intervention the reading may have come from (see [interventions.md](./interventions.md#reading-in-doubt-after-a-delete-or-an-edit)).

1. A page (`/equipments/{id}/edit/hours/correct`) shows the current reading and a **Corrected reading** field: empty from the header, or prefilled with the highest reading left on the equipment's interventions when opened from the question (`?hours=` in the URL). The user confirms or adjusts it.
2. Text: *"The reading becomes this value, even if it is lower than the current one."*
3. **Correct reading** (disabled while the field is empty or negative) saves via `PUT /equipments/{id}/hours/correction`: the reading becomes the value and `hours_updated_at` is set to "now". The user returns to the equipment detail. **Cancel** changes nothing.

### Flow: Toggle hour-meter on an existing equipment
1. User goes to the Info tab.
2. Turning `tracks_hours` on: a hours field appears, user sets initial value. It is prefilled with the last known reading (kept from an earlier tracking period), or 0 if there is none, and cannot be lower than that reading. On save, it becomes the reading and `hours_updated_at` is set to "now".
3. Turning `tracks_hours` off: the app warns that any task using `hours_interval` will be affected. Confirmation required. The last reading and its freshness are kept (hidden), so turning the hour-meter back on cannot lower it.

The hours field only appears while turning the hour-meter on. When editing an equipment that already tracks hours, the form has no hours field: the reading changes only through **"Update hours"** (or the Dashboard's **"Same hours"**), **"Correct reading"** and interventions.

### Flow: Change the icon
There are two ways to change the icon:

- **From the detail header**: click the icon shown before the name to open the **emoji picker**; selecting an emoji saves it immediately (a **Reset** restores 🔧).
- **From the create/edit form**: click the icon button to open the same picker; the choice is saved with the form.

The new icon then appears wherever the equipment is referenced (list cards, dashboard, detail header). The Info tab shows the current icon read-only.

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
3. On confirm, equipment and all its files are removed and user is returned to the list. Its group, if any, is kept, even when left empty.

### Flow: Manage a group
From the **⋯** menu of a section header on the Equipments list:

- **Rename**: a modal with the **Name** field, prefilled. **Save** (disabled while the name is empty) saves via `PUT /groups/{id}`. A name another group already has, ignoring case, shows *"A group with this name already exists"* and changes nothing. **Cancel** changes nothing.
- **Change icon**: opens the emoji picker (Reset to 🗂️); selecting an emoji saves it immediately.
- **Delete**: a confirmation modal, *"Delete the group "Winches"? Its 4 equipments are kept and no longer belong to a group."* (the count includes its decommissioned equipments, shown or not). On confirm (`DELETE /groups/{id}`), the section disappears and its equipments become top-level cards. No equipment, task or intervention is deleted.

Groups are created from [the Group picker](#the-group-picker) of the equipment form.

## Layout sketches

### List
```
+------------------------------------------------------+
|  Equipments                         [+ Add equipment]|
+------------------------------------------------------+
|                                                      |
|  +----------------+  +----------------+              |
|  |[🔧] Family Car |  |[🔧] Main Engine|              |
|  |                |  | 1 245 h        |              |
|  |                |  | upd. 2 mo ago  |              |
|  | Last: —        |  | Last: Oil ch.  |              |
|  | 🟢 All ok      |  | 🔴 Oil overdue |              |
|  +----------------+  +----------------+              |
|                                                      |
|  ▾ [🛟] Safety gear · 3           🟠 Due soon   [⋯]  |
|  +----------------+  +----------------+  +--------+  |
|  |[🦺] Life jacket|  |[🧯] Extinguish.|  | ...    |  |
|  +----------------+  +----------------+  +--------+  |
|                                                      |
|  ▸ [⚙️] Winches · 4               🔴 Overdue    [⋯]  |
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
