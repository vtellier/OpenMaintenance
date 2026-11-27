import { Equipment } from '@generated/api/models/Equipment'
import { Group } from '@generated/api/models/Group'
import { DecommissionableEquipment, isDecommissioned } from '@/lib/decommissioning'
import { shownIcon } from '@/lib/equipmentForm'
import { belongsTo, interventionOwner } from '@/lib/interventions'

// Groups organise the Equipments list (doc/data-model.md, "Group";
// doc/gui/equipments.md, "Layout"). This module holds the rules the list
// applies to them, so pages only render.

export const DEFAULT_GROUP_ICON = '🗂️'

/** A group as a picker lists it: its icon (the default when it has none), a space, its name. */
export function groupOptionLabel(group: Pick<Group, 'icon' | 'name'>): string {
  return shownIcon(group.icon, DEFAULT_GROUP_ICON) + ' ' + group.name
}

type NamedGroup = Pick<Group, 'id' | 'name'>
type GroupedEquipment = Pick<Equipment, 'id' | 'name' | 'groupId'> & DecommissionableEquipment

export type ListEntry<G extends NamedGroup, E extends GroupedEquipment> =
  // hidden: how many of its equipments are decommissioned and not shown.
  | { kind: 'group'; group: G; equipments: E[]; hidden: number }
  | { kind: 'equipment'; equipment: E }

export interface ListOptions {
  /** "Show decommissioned" is checked: list them too. */
  showDecommissioned?: boolean
}

// equipmentList arranges the Equipments list: one section per group, holding
// its equipments, and one top-level card per equipment with no group. Sections
// and cards are sorted together alphabetically by name, ignoring case; a group
// comes before an equipment of the same name. The equipments of a section are
// sorted the same way. Same-named equipments keep their creation order (id).
// An equipment whose group is unknown is shown ungrouped. Decommissioned
// equipments are left out unless showDecommissioned; a section counts the
// ones it leaves out.
export function equipmentList<G extends NamedGroup, E extends GroupedEquipment>(groups: G[], equipments: E[], options: ListOptions = {}): ListEntry<G, E>[] {
  const sections = new Map<number, { kind: 'group'; group: G; equipments: E[]; hidden: number }>()
  for (const group of groups) {
    if (group.id != null) sections.set(group.id, { kind: 'group', group, equipments: [], hidden: 0 })
  }

  const entries: ListEntry<G, E>[] = [...sections.values()]
  for (const equipment of equipments) {
    const section = equipment.groupId != null ? sections.get(equipment.groupId) : undefined
    if (isDecommissioned(equipment) && !options.showDecommissioned) {
      if (section) section.hidden++
    } else if (section) section.equipments.push(equipment)
    else entries.push({ kind: 'equipment', equipment })
  }

  for (const section of sections.values()) section.equipments.sort(byName)
  return entries.sort(byEntry)
}

/**
 * A block of the rendered list: a group's section, or a run of consecutive
 * ungrouped cards, which share one grid between the sections.
 */
export type ListBlock<G extends NamedGroup, E extends GroupedEquipment> =
  | { kind: 'group'; group: G; equipments: E[]; hidden: number }
  | { kind: 'cards'; equipments: E[] }

/** The list's entries (equipmentList) as the blocks it renders, in the same order. */
export function listBlocks<G extends NamedGroup, E extends GroupedEquipment>(entries: ListEntry<G, E>[]): ListBlock<G, E>[] {
  const blocks: ListBlock<G, E>[] = []
  for (const entry of entries) {
    if (entry.kind === 'group') {
      blocks.push(entry)
      continue
    }
    const last = blocks[blocks.length - 1]
    if (last?.kind === 'cards') last.equipments.push(entry.equipment)
    else blocks.push({ kind: 'cards', equipments: [entry.equipment] })
  }
  return blocks
}

/**
 * What an expanded section with no card shows: its equipments are all
 * decommissioned and hidden (`hidden` of them), or it has none.
 */
export function emptyGroupText(hidden: number): string {
  return hidden > 0 ? 'All equipments in this group are decommissioned.' : 'No equipments in this group.'
}

function byEntry(a: ListEntry<NamedGroup, GroupedEquipment>, b: ListEntry<NamedGroup, GroupedEquipment>): number {
  const name = compareNames(entryName(a), entryName(b))
  if (name !== 0) return name
  if (a.kind !== b.kind) return a.kind === 'group' ? -1 : 1
  return entryId(a) - entryId(b)
}

// byName orders groups or equipments alphabetically, ignoring case, then by
// id: the order of the Equipments list, also used by the pickers.
export function byName(a: { id?: number; name?: string }, b: { id?: number; name?: string }): number {
  return compareNames(a.name, b.name) || (a.id ?? 0) - (b.id ?? 0)
}

function entryName(e: ListEntry<NamedGroup, GroupedEquipment>): string | undefined {
  return e.kind === 'group' ? e.group.name : e.equipment.name
}

function entryId(e: ListEntry<NamedGroup, GroupedEquipment>): number {
  return (e.kind === 'group' ? e.group.id : e.equipment.id) ?? 0
}

// compareNames orders names alphabetically, ignoring case.
function compareNames(a: string | undefined, b: string | undefined): number {
  return (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'accent' })
}

export type EquipmentStatus = 'overdue' | 'due_soon' | 'ok'

type StatusTask = { dueStatus?: string | null }

const WORST_FIRST: EquipmentStatus[] = ['overdue', 'due_soon', 'ok']

const STATUS_BADGES: Record<EquipmentStatus, { label: string; className: string }> = {
  overdue: { label: 'Overdue', className: 'due-indicator due-indicator--overdue' },
  due_soon: { label: 'Due soon', className: 'due-indicator due-indicator--due-soon' },
  ok: { label: 'OK', className: 'due-indicator due-indicator--ok' },
}

/** The badge a status shows on a card or a section header: its label and its class (its color). */
export function statusBadge(status: EquipmentStatus): { label: string; className: string } {
  return STATUS_BADGES[status]
}

// equipmentStatus is the badge of an equipment's card: Overdue when any of its
// tasks is overdue, otherwise Due soon when any is due soon, otherwise OK.
// None when no task has a due status: the equipment has no task, or it is
// decommissioned and its tasks are never due.
export function equipmentStatus(tasks: StatusTask[]): EquipmentStatus | null {
  return WORST_FIRST.find(s => tasks.some(t => t.dueStatus === s)) ?? null
}

// groupStatus is the badge of a section header: the worst of its equipments'
// badges, given each equipment's tasks. None when none of them has a task.
export function groupStatus(tasksByEquipment: StatusTask[][]): EquipmentStatus | null {
  const statuses = tasksByEquipment.map(equipmentStatus)
  return WORST_FIRST.find(s => statuses.includes(s)) ?? null
}

// A History equipment filter: one equipment, or every equipment of a group.
export type HistoryFilter = { equipmentId: number } | { groupId: number } | null

type FilteredIntervention = { taskId?: number | null; equipmentId?: number | null }

// interventionsFor keeps the interventions the History filter selects. A group
// selects the equipments in it now: group membership is not recorded on
// interventions. A standard intervention belongs to its task's equipment, an
// exceptional one to its own equipment.
export function interventionsFor<I extends FilteredIntervention>(
  interventions: I[],
  filter: HistoryFilter,
  equipments: Pick<Equipment, 'id' | 'groupId'>[],
  tasks: { id?: number; equipmentId?: number }[],
): I[] {
  if (filter == null) return interventions
  const equipmentIds = 'groupId' in filter
    ? equipments.filter(eq => eq.groupId === filter.groupId).map(eq => eq.id)
    : [filter.equipmentId]
  const selected = new Set(equipmentIds)
  const owner = interventionOwner(equipmentIds, tasks.filter(t => selected.has(t.equipmentId)))
  return interventions.filter(inv => belongsTo(inv, owner))
}
