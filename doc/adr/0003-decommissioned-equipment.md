# 3. A decommissioned equipment keeps its history, and its tasks are never due

Date: 2026-11-18 · Issue #113

## Context

Equipment leaves service: an old dinghy and its outboards are sold, a bow thruster is removed, a life raft is replaced. Until now there were two choices. Keeping it left its tasks due, on the Dashboard and in the Equipments list. Deleting it took its whole history with it.

Backfilling past invoices makes this common: gear that was aboard for years under earlier owners has a history worth keeping, even though it is gone.

## Decision

An equipment can be **decommissioned**. It records the date it left service, `decommissioned_at`, the counterpart of `commissioned_at` (date of commissioning / date of decommissioning). An equipment with no `decommissioned_at` is in service; clearing the date puts it back in service.

The model:

- A decommissioned equipment **keeps everything**: its tasks, interventions, documents, photos and hour-meter reading. It **keeps its group** (ADR 0002).
- The date **cannot be in the future**, nor **before `commissioned_at`** when that is set.

Its tasks are **never due**: they have no due status and no urgency. So the equipment is not on the Dashboard, and it is left out of the hour-meter freshness banner.

Where it appears:

- **Equipment screens.** A *Decommissioned on* date, set and cleared from the edit form, shown on the Info tab next to the commissioning date. A *Decommissioned* badge in the detail header.
- **Equipments list.** Decommissioned equipments are hidden. A *Show decommissioned* option shows them dimmed, in their group.
- **History.** The global History still shows its interventions. The equipment filter still lists it, marked *decommissioned*.
- **Intervention forms.** They can still pick it, so past work can be logged. It is marked *(decommissioned)* and listed after the equipments in service.
- There is **no rule on the intervention date** against `decommissioned_at`.

## Alternatives considered

- **Delete the equipment.** Rejected: it deletes the history the user wants to keep, which is the point of backfilling.
- **An "archived" flag with no date.** Rejected: when the equipment left service is part of its history, as its commissioning date is, and a date is as easy to set as a flag.
- **Keep its tasks' due status and only hide it.** Rejected: a status that says *overdue* about gear that is gone means nothing, and every screen that shows statuses (Dashboard, card and section badges, Tasks tab) would have to filter it out on its own. With no status, those screens are right without knowing about decommissioning.
- **Refuse interventions dated after `decommissioned_at`.** Rejected: dates backfilled from old invoices are often approximate, and a rule that refuses them gets in the way of the backfilling this feature is for.
- **Leave decommissioned equipments out of the intervention forms.** Rejected: past work on them could no longer be logged.

## Consequences

- Clients send `decommissioned_at` back on every equipment edit, like `group_id`: an edit without it puts the equipment back in service.
- Putting an equipment back in service brings its tasks' due status back, computed from its history as before.
- A group's section counts and status only reflect the equipments it shows. Deleting a group still ungroups its decommissioned equipments too.
