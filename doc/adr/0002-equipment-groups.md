# 2. Groups only organise the Equipments list, one group per equipment

Date: 2026-11-18 · Issue #112

## Context

The flat Equipments list becomes hard to read once a boat has a few dozen equipments: four winches, the windlass, the anchor and chain, each sail, each piece of safety gear. The only way to shorten it was to merge several things into one broad equipment ("Deck gear"), which loses each item's own tasks and history.

## Decision

A group is a named set of equipments with no tasks, interventions or status of its own. An equipment belongs to at most one group. Groups do not nest.

Its other rules:

- A group has a name and an icon (an emoji, like an equipment's). Names are unique, ignoring case.
- A group can exist before it has any equipment.
- Deleting a group ungroups its equipments and never deletes them.

Where groups appear:

- **Equipments list.** Each group is a collapsible section. An equipment with no group is a card at the same level as the sections; there is no "No group" section.
- **Order, for now.** Sections and ungrouped equipments are sorted together, alphabetically by name, and the equipments inside a section are sorted alphabetically too.
- **Section header.** It shows the group's icon, its name, the number of its equipments, and the worst status among its equipments, derived the same way as the card badges, so a collapsed group never hides an overdue equipment.
- **Collapsing.** Sections are expanded by default. Collapsed or expanded is remembered per browser.
- **Managing groups.** The equipment form has a Group picker with "+ New group". A section header has Rename, Change icon and Delete.
- **History.** The global History equipment filter also offers the groups. Picking a group shows the interventions of all its equipments.
- **Unchanged.** The intervention forms (an intervention is for one equipment, so the equipment picker stays a list of equipments) and the Dashboard (blocks stay per equipment).

## Alternatives considered

- **A tree of equipments**, where any equipment can contain others. Rejected for now: the need is to find equipments, and a tree brings rules nobody needs yet: rolling history and status up the tree, sharing an hour-meter with sub-equipments, deleting a node that has children. Groups do not prevent a tree later.
- **Several groups per equipment (tags).** Rejected: an equipment would appear in several sections, and the list would grow long again. Views that cut across groups (e.g. "checked at the yearly safety inspection") would be a separate feature.
- **A free-text group field on the equipment.** Rejected: renaming a group would mean editing every equipment in it, a typo would create a new group, and a group could not exist empty.
- **A manual order** (a position for groups and equipments alike). Out of scope for now; it may come later.

## Consequences

- Work that covers several equipments of a group (e.g. servicing all the winches) is logged as one intervention per equipment.
- The Equipments list and the History filter are the only screens that know about groups, besides the equipment form that sets an equipment's group.
