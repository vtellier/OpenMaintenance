import { component, html, reactive } from '@arrow-js/core'
import { EquipmentApi, TaskApi, InterventionApi, GroupApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { extractErrorMessage, formatHours } from '@/lib/format'
import { relativeTime, isHoursVeryStale } from '@/lib/timestamp'
import { formatCalendarDate } from '@/lib/calendar-date'
import { EquipmentRow, GroupRow, InterventionRow, TaskRow, toEquipmentRow, toGroupRow, toInterventionRow, toTaskRow } from '@/lib/rows'
import { equipmentAvatar } from '@/components/EquipmentAvatar'
import { iconPicker } from '@/components/IconPicker'
import { groupPicker } from '@/components/GroupPicker'
import { DEFAULT_GROUP_ICON, EquipmentStatus, equipmentList, groupStatus } from '@/lib/equipmentGroups'
import { isDecommissioned } from '@/lib/decommissioning'
import { cardStatusLine, lastInterventionText, tasksByEquipment } from '@/lib/equipmentCard'
import { latestEquipmentIntervention } from '@/lib/interventions'
import { hoursFromInput } from '@/lib/hoursForm'
import { canAddEquipment, DEFAULT_ICON, NewEquipmentValues, newEquipmentForm, toNewEquipmentInput } from '@/lib/equipmentForm'
import { isCollapsed as isGroupCollapsed, readCollapsed, readShowDecommissioned, toggleCollapsed, writeCollapsed, writeShowDecommissioned } from '@/lib/equipmentsListPrefs'

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)
const interventionApi = new InterventionApi(apiConfig)
const groupApi = new GroupApi(apiConfig)

const STATUS_BADGE: Record<EquipmentStatus, { label: string; cls: string }> = {
  overdue: { label: 'Overdue', cls: 'due-indicator--overdue' },
  due_soon: { label: 'Due soon', cls: 'due-indicator--due-soon' },
  ok: { label: 'OK', cls: 'due-indicator--ok' },
}

export const EquipmentsPage = component(() => {
  const state = reactive({
    equipments: [] as EquipmentRow[],
    groups: [] as GroupRow[],
    tasksByEquipment: {} as Record<number, TaskRow[]>,
    interventions: [] as InterventionRow[],
    loading: true,
    error: null as string | null,
    showAddModal: false,
    addName: '',
    addDesc: '',
    addIcon: DEFAULT_ICON,
    addCommissionedAt: '',
    addTracksHours: false,
    addHours: 0,
    addGroupId: null as number | null,
    adding: false,
    addError: null as string | null,

    // Remembered per browser (equipmentsListPrefs.ts).
    collapsed: readCollapsed(),
    showDecommissioned: readShowDecommissioned(),
    menuGroupId: null as number | null,

    renameTarget: null as GroupRow | null,
    renameName: '',
    renameSaving: false,
    renameError: null as string | null,

    deleteTarget: null as GroupRow | null,
    deleteSaving: false,
    deleteError: null as string | null,

    groupError: null as string | null,
  })

  async function load() {
    state.loading = true
    state.error = null
    try {
      const [equipments, tasks, interventions, groups] = await Promise.all([
        equipmentApi.listEquipments(),
        taskApi.listTasks(),
        interventionApi.listInterventions(),
        groupApi.listGroups(),
      ])
      state.groups = groups.map(toGroupRow)
      state.equipments = equipments.map(toEquipmentRow)
      state.interventions = interventions.map(toInterventionRow)
      state.tasksByEquipment = tasksByEquipment(tasks.map(toTaskRow))
    } catch (err) {
      state.error = 'Failed to load equipments'
    } finally {
      state.loading = false
    }
  }

  load()

  // The Add equipment form's values, read from the state on each call, so a
  // slot that calls it updates.
  const addForm = (): NewEquipmentValues => ({
    name: state.addName,
    description: state.addDesc,
    icon: state.addIcon,
    groupId: state.addGroupId,
    commissionedAt: state.addCommissionedAt,
    tracksHours: state.addTracksHours,
    hours: state.addHours,
  })

  async function addEquipment() {
    if (!canAddEquipment(addForm())) return
    state.adding = true
    state.addError = null
    try {
      await equipmentApi.createEquipment({ equipmentInput: toNewEquipmentInput(addForm()) })
      const empty = newEquipmentForm()
      state.showAddModal = false
      state.addName = empty.name
      state.addDesc = empty.description
      state.addIcon = empty.icon
      state.addCommissionedAt = empty.commissionedAt
      state.addTracksHours = empty.tracksHours
      state.addHours = empty.hours
      state.addGroupId = empty.groupId
      await load()
    } catch (err) {
      state.addError = await extractErrorMessage(err, 'Failed to add equipment')
    } finally {
      state.adding = false
    }
  }

  function onAddClick() {
    state.showAddModal = true
  }

  function onCancelAdd() {
    state.showAddModal = false
  }

  function onOverlayClick(e: Event) {
    const el = e.target as HTMLElement
    if (el.classList.contains('modal-overlay')) state.showAddModal = false
  }

  function onToggleHours() {
    state.addTracksHours = !state.addTracksHours
  }

  // Called by renderList, so on every run of the slot that renders the list:
  // the card is computed afresh from the state each time.
  function renderCard(eq: EquipmentRow) {
    const tasks = state.tasksByEquipment[eq.id!] || []
    const decommissioned = isDecommissioned(eq)
    // A decommissioned equipment's hour-meter no longer matters: never stale.
    const hoursClass = !decommissioned && isHoursVeryStale(eq.hoursUpdatedAt) ? 'very-stale' : ''
    const cardClass = decommissioned ? 'equipment-card equipment-card--decommissioned' : 'equipment-card'
    const link = '/equipments/' + eq.id!
    const lastText = lastInterventionText(latestEquipmentIntervention(state.interventions, tasks), tasks)

    // The badge follows the shared rule, which the section headers use too.
    const statusLine = cardStatusLine(tasks)
    const statusLabel = statusLine ? STATUS_BADGE[statusLine.status].label : ''
    const statusClass = statusLine ? STATUS_BADGE[statusLine.status].cls : ''
    const statusText = statusLine?.text ?? ''

    return html`
    <a href="${link}" class="${cardClass}">
      <div class="equipment-card__head">
        ${equipmentAvatar(eq)}
        <p class="equipment-card__title">${eq.name}</p>
      </div>
      ${eq.description ? html`<p class="equipment-card__desc">${eq.description}</p>` : null}
      ${eq.tracksHours ? html`
        <div class="equipment-card__hours">
          <span>${formatHours(eq.hours)}</span>
          <span class="${hoursClass}">\u2022 ${relativeTime(eq.hoursUpdatedAt)}</span>
        </div>
      ` : null}
      <div class="equipment-card__meta">${lastText}</div>
      ${decommissioned ? html`
        <div class="equipment-card__due">
          <span class="due-indicator due-indicator--decommissioned">Decommissioned</span>
          ${formatCalendarDate(eq.decommissionedAt)}
        </div>
      ` : null}
      ${statusLabel ? html`
        <div class="equipment-card__due">
          <span class="${'due-indicator ' + statusClass}">${statusLabel}</span>
          ${statusText}
        </div>
      ` : null}
    </a>
    `
  }

  // ── Groups ──

  function isCollapsed(groupId: number): boolean {
    return isGroupCollapsed(state.collapsed, groupId)
  }

  function decommissionedCount(): number {
    return state.equipments.filter(eq => isDecommissioned(eq)).length
  }

  function onToggleShowDecommissioned() {
    state.showDecommissioned = !state.showDecommissioned
    writeShowDecommissioned(state.showDecommissioned)
  }

  function onToggleGroup(groupId: number) {
    state.collapsed = toggleCollapsed(state.collapsed, groupId)
    writeCollapsed(state.collapsed)
  }

  function onToggleMenu(groupId: number) {
    state.menuGroupId = state.menuGroupId === groupId ? null : groupId
  }

  function onCloseMenu() {
    state.menuGroupId = null
  }

  function onRenameClick(group: GroupRow) {
    state.menuGroupId = null
    state.renameTarget = group
    state.renameName = group.name ?? ''
    state.renameError = null
  }

  async function onConfirmRename() {
    const group = state.renameTarget
    const name = state.renameName.trim()
    if (!group || group.id == null || !name) return
    state.renameSaving = true
    state.renameError = null
    try {
      await groupApi.updateGroup({ id: group.id, groupInput: { name, icon: group.icon } })
      state.renameTarget = null
      await load()
    } catch (err) {
      state.renameError = await extractErrorMessage(err, 'Failed to rename group')
    } finally {
      state.renameSaving = false
    }
  }

  async function onChangeGroupIcon(group: GroupRow, icon: string) {
    state.menuGroupId = null
    if (group.id == null || icon === group.icon) return
    state.groupError = null
    try {
      await groupApi.updateGroup({ id: group.id, groupInput: { name: group.name ?? '', icon } })
      await load()
    } catch (err) {
      state.groupError = await extractErrorMessage(err, 'Failed to change the group icon')
    }
  }

  function onDeleteGroupClick(group: GroupRow) {
    state.menuGroupId = null
    state.deleteTarget = group
    state.deleteError = null
  }

  async function onConfirmDeleteGroup() {
    const group = state.deleteTarget
    if (!group || group.id == null) return
    state.deleteSaving = true
    state.deleteError = null
    try {
      await groupApi.deleteGroup({ id: group.id })
      state.deleteTarget = null
      await load()
    } catch (err) {
      state.deleteError = await extractErrorMessage(err, 'Failed to delete group')
    } finally {
      state.deleteSaving = false
    }
  }

  function onModalOverlayClick(e: Event, close: () => void) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) close()
  }

  function membersText(n: number): string {
    return n === 1 ? '1 equipment' : n + ' equipments'
  }

  function deleteGroupText(group: GroupRow): string {
    const n = state.equipments.filter(eq => eq.groupId === group.id).length
    const question = 'Delete the group "' + (group.name ?? '') + '"? '
    if (n === 0) return question + 'It has no equipment.'
    return question + 'Its ' + membersText(n) + (n === 1
      ? ' is kept and no longer belongs to a group.'
      : ' are kept and no longer belong to a group.')
  }

  // hidden: how many of its equipments are decommissioned and not shown.
  function renderSection(group: GroupRow, equipments: EquipmentRow[], hidden: number) {
    const groupId = group.id!
    const status = groupStatus(equipments.map(eq => state.tasksByEquipment[eq.id!] || []))
    const badge = status ? STATUS_BADGE[status] : null
    const icon = group.icon || DEFAULT_GROUP_ICON

    return html`
    <section class="equipment-group">
      <div class="equipment-group__header">
        <button type="button" class="equipment-group__toggle" aria-expanded="${() => String(!isCollapsed(groupId))}" @click="${() => onToggleGroup(groupId)}">
          <span class="equipment-group__chevron" aria-hidden="true">${() => isCollapsed(groupId) ? '\u25B8' : '\u25BE'}</span>
          <span class="equipment-avatar equipment-avatar--sm"><span class="equipment-avatar__emoji">${icon}</span></span>
          <span class="equipment-group__name">${group.name}</span>
          <span class="equipment-group__count">\u00B7 ${String(equipments.length)}</span>
          ${badge ? html`<span class="${'due-indicator ' + badge.cls}">${badge.label}</span>` : null}
        </button>
        <div class="equipment-group__menu">
          <button type="button" class="btn btn--small" aria-label="Group actions" title="Group actions" @click="${() => onToggleMenu(groupId)}">\u22EF</button>
          ${() => state.menuGroupId === groupId ? html`
            <div class="menu__backdrop" @click="${onCloseMenu}"></div>
            <div class="menu">
              <button type="button" class="menu__item" @click="${() => onRenameClick(group)}">Rename</button>
              ${iconPicker(() => icon, (v) => onChangeGroupIcon(group, v), { variant: 'menuitem', defaultIcon: DEFAULT_GROUP_ICON })}
              <button type="button" class="menu__item menu__item--danger" @click="${() => onDeleteGroupClick(group)}">Delete</button>
            </div>
          ` : null}
        </div>
      </div>
      ${() => isCollapsed(groupId) ? null : (equipments.length > 0
        ? html`<div class="equipment-grid">${equipments.map(eq => renderCard(eq))}</div>`
        : html`<p class="equipment-group__empty">${hidden > 0 ? 'All equipments in this group are decommissioned.' : 'No equipments in this group.'}</p>`)}
    </section>
    `
  }

  // Bumped on every render of the list, to key its blocks (see renderList).
  let listGeneration = 0

  function renderList() {
    const entries = equipmentList(state.groups, state.equipments, { showDecommissioned: state.showDecommissioned })
    if (entries.length === 0) return html`<p class="page__empty">No equipments in service.</p>`
    // Each block is keyed by this render's generation: when the list re-renders
    // without a reload (e.g. "+ New group" adds a group), Arrow builds every
    // block afresh instead of matching them by position and keeping their
    // stale static content (Arrow.js skill, gotcha 9).
    const generation = ++listGeneration
    // Consecutive ungrouped cards share one grid, between the sections.
    const blocks: ReturnType<typeof html>[] = []
    let cards: EquipmentRow[] = []
    const push = (block: ReturnType<typeof html>) => {
      blocks.push(block.key(generation + ':' + blocks.length))
    }
    const flush = () => {
      if (cards.length === 0) return
      const run = cards
      push(html`<div class="equipment-grid">${run.map(eq => renderCard(eq))}</div>`)
      cards = []
    }
    for (const entry of entries) {
      if (entry.kind === 'equipment') {
        cards.push(entry.equipment)
      } else {
        flush()
        push(renderSection(entry.group, entry.equipments, entry.hidden))
      }
    }
    flush()
    // A function, so the list updates when the slot that renders it re-runs.
    return html`<div class="equipment-list">${() => blocks}</div>`
  }

  const renameModalHtml = html`<div class="modal-overlay" @click="${(e: Event) => onModalOverlayClick(e, () => { state.renameTarget = null })}">
    <div class="modal">
      <h2 class="modal__title">Rename group</h2>
      ${() => state.renameError ? html`<div class="flash flash--error">${state.renameError}</div>` : null}
      <div class="form-field">
        <label class="form-field__label">Name *</label>
        <input aria-label="Group name" .value="${() => state.renameName}" @input="${(e: Event) => { state.renameName = (e.target as HTMLInputElement).value }}" />
      </div>
      <div class="modal__actions">
        <button class="btn" @click="${() => { state.renameTarget = null }}">Cancel</button>
        <button class="btn btn--accent" @click="${onConfirmRename}" disabled="${() => state.renameSaving || !state.renameName.trim()}">
          ${() => state.renameSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  </div>`

  const deleteGroupModalHtml = html`<div class="modal-overlay" @click="${(e: Event) => onModalOverlayClick(e, () => { state.deleteTarget = null })}">
    <div class="modal">
      <h2 class="modal__title">Delete group</h2>
      ${() => state.deleteError ? html`<div class="flash flash--error">${state.deleteError}</div>` : null}
      <p class="confirm-text">${() => state.deleteTarget ? deleteGroupText(state.deleteTarget) : ''}</p>
      <div class="modal__actions">
        <button class="btn" @click="${() => { state.deleteTarget = null }}">Cancel</button>
        <button class="btn btn--danger" @click="${onConfirmDeleteGroup}" disabled="${() => state.deleteSaving}">
          ${() => state.deleteSaving ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  </div>`

  const addModalHtml = html`<div class="modal-overlay" @click="${onOverlayClick}">
    <div class="modal">
      <h2 class="modal__title">Add equipment</h2>
      ${() => state.addError ? html`<div class="flash flash--error">${state.addError}</div>` : null}
      <div class="form-field">
        <label class="form-field__label">Name *</label>
        <input placeholder="e.g. Main Engine" .value="${() => state.addName}" @input="${(e: Event) => { state.addName = (e.target as HTMLInputElement).value }}" />
      </div>
      <div class="form-field">
        <label class="form-field__label">Description</label>
        <textarea placeholder="Optional description" .value="${() => state.addDesc}" @input="${(e: Event) => { state.addDesc = (e.target as HTMLTextAreaElement).value }}"></textarea>
      </div>
      <div class="form-field">
        <label class="form-field__label">Icon</label>
        ${iconPicker(() => state.addIcon, (v) => { state.addIcon = v })}
        <p class="form-field__hint">Shown in lists and the dashboard. Defaults to 🔧.</p>
      </div>
      <div class="form-field">
        <label class="form-field__label">Group</label>
        ${groupPicker({
          groups: () => state.groups,
          current: () => state.addGroupId,
          onSelect: (id) => { state.addGroupId = id },
          onCreated: (g) => { state.groups = [...state.groups, g] },
        })}
      </div>
      <div class="form-field">
        <label class="form-field__label">Date of commissioning</label>
        <input type="date" aria-label="Date of commissioning" .value="${() => state.addCommissionedAt}" @input="${(e: Event) => { state.addCommissionedAt = (e.target as HTMLInputElement).value }}" />
      </div>
      <div class="toggle-row">
        <span class="toggle-row__label">This equipment has an hour-meter</span>
        <label class="toggle-switch">
          <input type="checkbox" aria-label="This equipment has an hour-meter" .checked="${() => state.addTracksHours}" @change="${onToggleHours}" />
          <span class="toggle-slider"></span>
        </label>
      </div>
      ${() => state.addTracksHours ? html`
        <div class="form-field">
          <label class="form-field__label">Initial hours</label>
          <input type="number" min="0" aria-label="Initial hours" .value="${() => String(state.addHours)}" @input="${(e: Event) => { state.addHours = hoursFromInput((e.target as HTMLInputElement).value) }}" />
        </div>
      ` : null}
      <div class="modal__actions">
        <button class="btn" @click="${onCancelAdd}">Cancel</button>
        <button class="btn btn--accent" @click="${addEquipment}" disabled="${() => state.adding || !canAddEquipment(addForm())}">
          ${() => state.adding ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  </div>`

  return html`<section class="page">
    <div class="page__header">
      <h1>Equipments</h1>
      <div class="page__header-actions">
        ${() => decommissionedCount() > 0 ? html`<label class="form-field__checkbox-label">
          <input type="checkbox" .checked="${() => state.showDecommissioned}" @change="${onToggleShowDecommissioned}" />
          Show decommissioned (${() => String(decommissionedCount())})
        </label>` : null}
        <button class="btn btn--accent" @click="${onAddClick}">+ Add equipment</button>
      </div>
    </div>

    ${() => state.loading ? html`<p class="page__empty">Loading equipments...</p>` : null}

    ${() => state.error ? html`<div class="flash flash--error">${state.error}</div>` : null}

    ${() => state.groupError ? html`<div class="flash flash--error">${state.groupError}</div>` : null}

    ${() => !state.loading && !state.error && state.equipments.length === 0 && state.groups.length === 0
      ? html`<p class="page__empty">No equipments yet. <a href="#" @click="${onAddClick}">Add your first equipment</a>.</p>`
      : null}

    ${() => !state.loading && (state.equipments.length > 0 || state.groups.length > 0)
      ? renderList()
      : null}

    ${() => state.showAddModal ? addModalHtml : null}
    ${() => state.renameTarget ? renameModalHtml : null}
    ${() => state.deleteTarget ? deleteGroupModalHtml : null}

    <button class="fab" aria-label="Add equipment" @click="${onAddClick}">+</button>
  </section>`
})
