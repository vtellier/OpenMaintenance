# OpenMaintenance

Tracking the maintenance of owned equipment (boats, cars, homes): what must be done, when, and what was done.

## Language

**Equipment**:
A maintained thing, or a component of one, that tasks and interventions belong to (e.g. "Main Engine", "Life jacket (red)").
_Avoid_: Asset, item

**Group**:
A named set of equipments that organises the Equipments list (e.g. "Winches": port winch, starboard winch, port and starboard cabin-top winches). It has no tasks, interventions or status of its own. An equipment belongs to at most one group.
_Avoid_: Category, folder, system, tag

**Task**:
A recurring maintenance checkpoint on one equipment, which says when it is next due.
_Avoid_: Job, schedule

**Interval task**:
A task due again after a number of months and/or hours counted from when it was last done.

**Expiry task**:
A task for a part that carries a printed expiry date, due when that date is reached rather than after an interval (e.g. "Replace CO2 cartridge"). The task stands for the part; parts are not modelled on their own.
_Avoid_: Part, obsolescence task

**Expiry date**:
The date printed on a part after which it must be replaced, recorded on the intervention that fits the part. One per expiry task: when several identical parts are replaced together, the earliest date is the one that counts.
_Avoid_: Obsolescence date, use-by date, best-before

**Current expiry date**:
The expiry date of the part already fitted when an expiry task is created, before any intervention records one.

**Intervention**:
A recorded maintenance action on an equipment, either for a task (standard) or a one-off (exceptional).
_Avoid_: Log entry, job
