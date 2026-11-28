import { Group } from '@generated/api/models/Group'
import { GroupInput } from '@generated/api/models/GroupInput'
import { DEFAULT_GROUP_ICON } from '@/lib/equipmentGroups'
import { extractErrorMessage } from '@/lib/format'
import { GroupRow, toGroupRow } from '@/lib/rows'

// The Group picker's "+ New group" form, in the equipment forms: it creates
// the group at once (doc/gui/equipments.md, "The Group picker"). And the
// actions of a group's menu on the Equipments list: Rename, Change icon and
// Delete (doc/gui/equipments.md, "Flow: Manage a group").

export interface NewGroupValues {
  name: string
  icon: string
}

/** "+ New group" opens empty, with the default group icon. */
export function newGroupForm(): NewGroupValues {
  return { name: '', icon: DEFAULT_GROUP_ICON }
}

/** A name is all "+ New group" requires. */
export function canCreateGroup(form: NewGroupValues): boolean {
  return form.name.trim() !== ''
}

/** The part of the generated GroupApi that "+ New group" saves through. */
export interface GroupCreator {
  createGroup(req: { groupInput: GroupInput }): Promise<Group>
}

/**
 * Creates the group, its name trimmed. Resolves to the group created, or to
 * the reason it failed, as the backend gives it (a name another group has,
 * for one). Call only when canCreateGroup.
 */
export async function saveNewGroup(form: NewGroupValues, api: GroupCreator): Promise<{ group: GroupRow } | { error: string }> {
  try {
    const group = await api.createGroup({ groupInput: { name: form.name.trim(), icon: form.icon } })
    return { group: toGroupRow(group) }
  } catch (err: unknown) {
    return { error: await extractErrorMessage(err, 'Failed to create group') }
  }
}

// ── A group's menu ──

/** A name is all Rename requires. */
export function canRenameGroup(name: string): boolean {
  return name.trim() !== ''
}

/** The parts of the generated GroupApi that a group's menu saves through. */
export interface GroupUpdater {
  updateGroup(req: { id: number, groupInput: GroupInput }): Promise<unknown>
}

export interface GroupDeleter {
  deleteGroup(req: { id: number }): Promise<unknown>
}

/**
 * Renames the group, the name trimmed, its icon kept. Resolves to null on
 * success, or to the reason it failed, as the backend gives it (a name
 * another group has, for one). Call only when canRenameGroup.
 */
export async function renameGroup(group: Pick<GroupRow, 'id' | 'icon'>, name: string, api: GroupUpdater): Promise<string | null> {
  try {
    await api.updateGroup({ id: group.id!, groupInput: { name: name.trim(), icon: group.icon } })
    return null
  } catch (err: unknown) {
    return extractErrorMessage(err, 'Failed to rename group')
  }
}

/**
 * Whether picking this icon leaves nothing to save: it is the one the group
 * already has (or the group is not saved yet).
 */
export function iconUnchanged(group: Pick<GroupRow, 'id' | 'icon'>, icon: string): boolean {
  return group.id == null || icon === group.icon
}

/**
 * Changes the group's icon, its name kept: saved at once. Resolves to null on
 * success, or to the reason it failed, as the backend gives it. Call only
 * when the icon changes (iconUnchanged).
 */
export async function changeGroupIcon(group: Pick<GroupRow, 'id' | 'name'>, icon: string, api: GroupUpdater): Promise<string | null> {
  try {
    await api.updateGroup({ id: group.id!, groupInput: { name: group.name ?? '', icon } })
    return null
  } catch (err: unknown) {
    return extractErrorMessage(err, 'Failed to change the group icon')
  }
}

/**
 * The Delete confirmation's question, with how many equipments the group
 * has, decommissioned ones included: they are kept, with no group.
 */
export function deleteGroupText(group: Pick<GroupRow, 'id' | 'name'>, equipments: { groupId?: number | null }[]): string {
  const n = equipments.filter(eq => eq.groupId === group.id).length
  const question = 'Delete the group "' + (group.name ?? '') + '"? '
  if (n === 0) return question + 'It has no equipment.'
  return n === 1
    ? question + 'Its 1 equipment is kept and no longer belongs to a group.'
    : question + 'Its ' + n + ' equipments are kept and no longer belong to a group.'
}

/**
 * Deletes the group; its equipments are kept, with no group. Resolves to
 * null on success, or to the reason it failed, as the backend gives it.
 */
export async function deleteGroup(group: Pick<GroupRow, 'id'>, api: GroupDeleter): Promise<string | null> {
  try {
    await api.deleteGroup({ id: group.id! })
    return null
  } catch (err: unknown) {
    return extractErrorMessage(err, 'Failed to delete group')
  }
}
