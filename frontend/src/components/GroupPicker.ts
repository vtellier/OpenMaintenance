import { html, reactive } from '@arrow-js/core'
import { GroupApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { iconPicker } from '@/components/IconPicker'
import { DEFAULT_GROUP_ICON, byName } from '@/lib/equipmentGroups'
import { extractErrorMessage } from '@/lib/format'
import { GroupRow, toGroupRow } from '@/lib/rows'

const groupApi = new GroupApi(apiConfig)

const NEW_GROUP = 'new'

export interface GroupPickerProps {
  groups: () => GroupRow[]
  current: () => number | null
  onSelect: (groupId: number | null) => void
  // Called with a group "+ New group" just created, before it is selected.
  onCreated: (group: GroupRow) => void
}

// groupPicker is the Group field of the equipment create and edit forms
// (doc/gui/equipments.md, "The Group picker"): "No group", the groups
// alphabetically, then "+ New group", which opens an inline form that creates
// the group at once and selects it.
export function groupPicker(props: GroupPickerProps) {
  const ui = reactive({
    creating: false,
    name: '',
    icon: DEFAULT_GROUP_ICON,
    saving: false,
    error: null as string | null,
  })

  const selectValue = () => ui.creating ? NEW_GROUP : (props.current() != null ? String(props.current()) : '')

  function onChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value
    if (value === NEW_GROUP) {
      ui.creating = true
      ui.name = ''
      ui.icon = DEFAULT_GROUP_ICON
      ui.error = null
      return
    }
    props.onSelect(value ? parseInt(value, 10) : null)
  }

  function onCancel() {
    ui.creating = false
  }

  async function onCreate() {
    const name = ui.name.trim()
    if (!name) return
    ui.saving = true
    ui.error = null
    try {
      const group = await groupApi.createGroup({ groupInput: { name, icon: ui.icon } })
      props.onCreated(toGroupRow(group))
      props.onSelect(group.id ?? null)
      ui.creating = false
    } catch (err) {
      ui.error = await extractErrorMessage(err, 'Failed to create group')
    } finally {
      ui.saving = false
    }
  }

  return html`
    <select aria-label="Group" .value="${selectValue}" @change="${onChange}">
      <option value="">No group</option>
      ${() => [...props.groups()].sort(byName).map(g => {
        const label = (g.icon || DEFAULT_GROUP_ICON) + ' ' + g.name
        return !ui.creating && props.current() === g.id
          ? html`<option value="${String(g.id)}" selected="selected">${label}</option>`
          : html`<option value="${String(g.id)}">${label}</option>`
      })}
      <option value="${NEW_GROUP}">+ New group</option>
    </select>
    ${() => ui.creating ? html`
      <div class="group-picker__new">
        ${() => ui.error ? html`<div class="flash flash--error">${ui.error}</div>` : null}
        <div class="group-picker__row">
          ${iconPicker(() => ui.icon, (v) => { ui.icon = v }, { defaultIcon: DEFAULT_GROUP_ICON })}
          <input aria-label="New group name" placeholder="e.g. Winches" .value="${() => ui.name}" @input="${(e: Event) => { ui.name = (e.target as HTMLInputElement).value }}" />
        </div>
        <div class="group-picker__actions">
          <button type="button" class="btn btn--small" @click="${onCancel}">Cancel</button>
          <button type="button" class="btn btn--small btn--accent" @click="${onCreate}" disabled="${() => ui.saving || !ui.name.trim()}">
            ${() => ui.saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    ` : null}`
}
