import { Group } from '@generated/api/models/Group'
import { GroupInput } from '@generated/api/models/GroupInput'
import { DEFAULT_GROUP_ICON } from '@/lib/equipmentGroups'
import { extractErrorMessage } from '@/lib/format'
import { GroupRow, toGroupRow } from '@/lib/rows'

// The Group picker's "+ New group" form, in the equipment forms: it creates
// the group at once (doc/gui/equipments.md, "The Group picker").

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
