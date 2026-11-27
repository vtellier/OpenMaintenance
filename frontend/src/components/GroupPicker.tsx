import { useState } from 'react'
import { GroupApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { IconPicker } from '@/components/IconPicker'
import { byName, DEFAULT_GROUP_ICON, groupOptionLabel } from '@/lib/equipmentGroups'
import { canCreateGroup, newGroupForm, NewGroupValues, saveNewGroup } from '@/lib/groupForm'
import { GroupRow } from '@/lib/rows'

const groupApi = new GroupApi(apiConfig)

/** The select's value for "+ New group". */
const NEW_GROUP = 'new'

export interface GroupPickerProps {
  groups: GroupRow[]
  /** The group picked, or null for "No group". */
  current: number | null
  onSelect: (groupId: number | null) => void
  /** Called with a group "+ New group" just created, before it is selected. */
  onCreated: (group: GroupRow) => void
}

/**
 * The Group field of the equipment create and edit forms
 * (doc/gui/equipments.md, "The Group picker"): "No group", the groups
 * alphabetically, then "+ New group", which opens an inline form that creates
 * the group at once and selects it.
 */
export function GroupPicker({ groups, current, onSelect, onCreated }: GroupPickerProps) {
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<NewGroupValues>(newGroupForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // #175, kept in this pure port of pre-react: after the inline form's
  // Cancel, the picker shows "No group" while the form keeps the group picked
  // before, until the picker changes again.
  const [showsNoGroup, setShowsNoGroup] = useState(false)

  let value = ''
  if (creating) value = NEW_GROUP
  else if (current != null && !showsNoGroup) value = String(current)

  function chooseGroup(next: string) {
    setShowsNoGroup(false)
    if (next === NEW_GROUP) {
      setCreating(true)
      setForm(newGroupForm())
      setError(null)
      return
    }
    onSelect(next ? parseInt(next, 10) : null)
  }

  function onCancel() {
    setCreating(false)
    setShowsNoGroup(true)
  }

  async function onCreate() {
    if (saving || !canCreateGroup(form)) return
    setSaving(true)
    setError(null)
    const result = await saveNewGroup(form, groupApi)
    if ('group' in result) {
      onCreated(result.group)
      onSelect(result.group.id ?? null)
      setCreating(false)
    } else {
      setError(result.error)
    }
    setSaving(false)
  }

  return (
    <>
      <select aria-label="Group" value={value} onChange={e => chooseGroup(e.target.value)}>
        <option value="">No group</option>
        {[...groups].sort(byName).map(g => (
          <option key={g.id} value={String(g.id)}>{groupOptionLabel(g)}</option>
        ))}
        <option value={NEW_GROUP}>+ New group</option>
      </select>
      {creating && (
        <div className="group-picker__new">
          {error && <div className="flash flash--error">{error}</div>}
          <div className="group-picker__row">
            <IconPicker current={form.icon} onSelect={icon => setForm(f => ({ ...f, icon }))} defaultIcon={DEFAULT_GROUP_ICON} />
            <input
              aria-label="New group name"
              placeholder="e.g. Winches"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="group-picker__actions">
            <button type="button" className="btn btn--small" onClick={onCancel}>Cancel</button>
            <button type="button" className="btn btn--small btn--accent" onClick={onCreate} disabled={saving || !canCreateGroup(form)}>
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
