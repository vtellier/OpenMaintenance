import { component, html, reactive } from '@arrow-js/core'
import { Equipment } from '@generated/api/models/Equipment'
import { Task } from '@generated/api/models/Task'
import { Intervention } from '@generated/api/models/Intervention'
import { Group } from '@generated/api/models/Group'
import { EquipmentApi, TaskApi, InterventionApi, GroupApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { extractErrorMessage, formatHours } from '@/lib/format'
import { dueTimingText } from '@/lib/dueTiming'
import { byUrgency } from '@/lib/urgency'
import { relativeTime, isHoursVeryStale } from '@/lib/timestamp'
import { WithCalendarDates, formatCalendarDate, compareCalendarDates, fromApiDate, fromApiDateTime, toApiDate } from '@/lib/calendar-date'
import { equipmentAvatar } from '@/components/EquipmentAvatar'
import { iconPicker } from '@/components/IconPicker'
import { groupPicker } from '@/components/GroupPicker'
import { DEFAULT_GROUP_ICON, EquipmentStatus, equipmentList, equipmentStatus, groupStatus } from '@/lib/equipmentGroups'

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)
const interventionApi = new InterventionApi(apiConfig)
const groupApi = new GroupApi(apiConfig)

// Collapsed sections are remembered per browser (doc/gui/equipments.md,
// "Section header"): the ids of the collapsed groups.
const COLLAPSED_KEY = 'openmaintenance.equipments.collapsedGroups'

function readCollapsed(): Record<number, boolean> {
  try {
    const ids = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]')
    const out: Record<number, boolean> = {}
    if (Array.isArray(ids)) for (const id of ids) if (typeof id === 'number') out[id] = true
    return out
  } catch {
    return {}
  }
}

function writeCollapsed(collapsed: Record<number, boolean>) {
  try {
    const ids = Object.keys(collapsed).filter(k => collapsed[Number(k)]).map(Number)
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(ids))
  } catch { /* storage unavailable: the state lasts for this page only */ }
}

const STATUS_BADGE: Record<EquipmentStatus, { label: string; cls: string }> = {
  overdue: { label: 'Overdue', cls: 'due-indicator--overdue' },
  due_soon: { label: 'Due soon', cls: 'due-indicator--due-soon' },
  ok: { label: 'OK', cls: 'due-indicator--ok' },
}

type TaskRow = WithCalendarDates<Task, 'nextDueDate'>
type InterventionRow = WithCalendarDates<Intervention, 'date' | 'expiryDate'>

export const EquipmentsPage = component(() => {
  const state = reactive({
    equipments: [] as Equipment[],
    groups: [] as Group[],
    tasksByEquipment: {} as Record<number, TaskRow[]>,
    interventions: [] as InterventionRow[],
    loading: true,
    error: null as string | null,
    showAddModal: false,
    addName: '',
    addDesc: '',
    addIcon: '🔧',
    addCommissionedAt: '',
    addTracksHours: false,
    addHours: 0,
    addGroupId: null as number | null,
    adding: false,
    addError: null as string | null,

    collapsed: readCollapsed(),
    menuGroupId: null as number | null,

    renameTarget: null as Group | null,
    renameName: '',
    renameSaving: false,
    renameError: null as string | null,

    deleteTarget: null as Group | null,
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
      state.groups = groups.map((g: any) => ({
        ...g,
        createdAt: g.createdAt?.toISOString(),
        updatedAt: g.updatedAt?.toISOString(),
      }))
      state.equipments = equipments.map((eq: any) => ({
        ...eq,
        hoursUpdatedAt: eq.hoursUpdatedAt?.toISOString(),
        createdAt: eq.createdAt?.toISOString(),
        updatedAt: eq.updatedAt?.toISOString(),
      }))
      state.interventions = interventions.map((inv: any) => ({
        ...inv,
        date: fromApiDateTime(inv.date),
        expiryDate: fromApiDate(inv.expiryDate),
        createdAt: inv.createdAt?.toISOString(),
        updatedAt: inv.updatedAt?.toISOString(),
      }))

      const grouped: Record<number, TaskRow[]> = {}
      for (const t of tasks) {
        const eid = t.equipmentId ?? 0
        if (!grouped[eid]) grouped[eid] = []
        grouped[eid].push({
          ...t,
          nextDueDate: fromApiDate(t.nextDueDate),
        })
      }
      state.tasksByEquipment = grouped
    } catch (err) {
      state.error = 'Failed to load equipments'
    } finally {
      state.loading = false
    }
  }

  load()

  function latestIntervention(equipmentId: number): InterventionRow | null {
    const tasks = state.tasksByEquipment[equipmentId] || []
    const taskIds = new Set(tasks.map((t: TaskRow) => t.id))
    let latest: InterventionRow | null = null
    for (const inv of state.interventions) {
      if (inv.taskId != null && taskIds.has(inv.taskId)) {
        if (!latest || compareCalendarDates(inv.date, latest.date) > 0) {
          latest = inv
        }
      }
    }
    return latest
  }

  function cropText(s: string, maxLen = 30): string {
    const chars = [...s]
    return chars.length > maxLen ? chars.slice(0, maxLen).join('') + '…' : s
  }

  function taskName(id: number | null | undefined): string {
    for (const tasks of Object.values(state.tasksByEquipment)) {
      const t = tasks.find((tt: TaskRow) => tt.id === id)
      if (t) return t.name || ''
    }
    return ''
  }

  async function addEquipment() {
    const name = state.addName.trim()
    if (!name) return
    state.adding = true
    state.addError = null
    try {
      await equipmentApi.createEquipment({
        equipmentInput: {
          name,
          description: state.addDesc.trim() || undefined,
          icon: state.addIcon.trim() || undefined,
          groupId: state.addGroupId,
          commissionedAt: state.addCommissionedAt ? toApiDate(state.addCommissionedAt) : undefined,
          tracksHours: state.addTracksHours,
          hours: state.addTracksHours ? state.addHours : undefined,
        },
      })
      state.showAddModal = false
      state.addName = ''
      state.addDesc = ''
      state.addIcon = '🔧'
      state.addCommissionedAt = ''
      state.addTracksHours = false
      state.addHours = 0
      state.addGroupId = null
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

  function renderCard(eq: Equipment) {
    const lastInv = latestIntervention(eq.id!)
    const tasks = state.tasksByEquipment[eq.id!] || []
    const hoursClass = isHoursVeryStale(eq.hoursUpdatedAt) ? 'very-stale' : ''
    const link = '/equipments/' + eq.id!
    var metaHtml

    if (lastInv) {
      metaHtml = 'Last: ' + taskName(lastInv.taskId) + ', ' + formatCalendarDate(lastInv.date)
    } else {
      metaHtml = 'No intervention yet'
    }

    // The badge follows the shared rule, which the section headers use too.
    const status = equipmentStatus(tasks)
    const statusLabel = status ? STATUS_BADGE[status].label : ''
    const statusClass = status ? STATUS_BADGE[status].cls : ''
    let statusText = ''

    if (status === 'overdue' || status === 'due_soon') {
      const due = tasks.filter((t: TaskRow) => t.dueStatus === status)
      if (due.length === 1) {
        const t = due[0]
        const timing = dueTimingText(t)
        statusText = cropText(t.name || '') + (timing ? ' \u2014 ' + timing : '')
      } else {
        const mostUrgent = [...due].sort(byUrgency)[0]
        const timing = dueTimingText(mostUrgent)
        statusText = due.length + ' tasks' + (timing ? ' \u2014 most urgent ' + timing : '')
      }
    } else if (status === 'ok') {
      statusText = 'All clear!'
    }

    return html`
    <a href="${link}" class="equipment-card">
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
      <div class="equipment-card__meta">${metaHtml}</div>
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
    return !!state.collapsed[groupId]
  }

  function onToggleGroup(groupId: number) {
    state.collapsed = { ...state.collapsed, [groupId]: !isCollapsed(groupId) }
    writeCollapsed(state.collapsed)
  }

  function onToggleMenu(groupId: number) {
    state.menuGroupId = state.menuGroupId === groupId ? null : groupId
  }

  function onCloseMenu() {
    state.menuGroupId = null
  }

  function onRenameClick(group: Group) {
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

  async function onChangeGroupIcon(group: Group, icon: string) {
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

  function onDeleteGroupClick(group: Group) {
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

  function deleteGroupText(group: Group): string {
    const n = state.equipments.filter(eq => eq.groupId === group.id).length
    const question = 'Delete the group "' + (group.name ?? '') + '"? '
    if (n === 0) return question + 'It has no equipment.'
    return question + 'Its ' + membersText(n) + (n === 1
      ? ' is kept and no longer belongs to a group.'
      : ' are kept and no longer belong to a group.')
  }

  function renderSection(group: Group, equipments: Equipment[]) {
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
        : html`<p class="equipment-group__empty">No equipments in this group.</p>`)}
    </section>
    `
  }

  // Bumped on every render of the list, to key its blocks (see renderList).
  let listGeneration = 0

  function renderList() {
    const entries = equipmentList(state.groups, state.equipments)
    // Each block is keyed by this render's generation: when the list re-renders
    // without a reload (e.g. "+ New group" adds a group), Arrow builds every
    // block afresh instead of matching them by position and keeping their
    // stale static content (Arrow.js skill, gotcha 9).
    const generation = ++listGeneration
    // Consecutive ungrouped cards share one grid, between the sections.
    const blocks: ReturnType<typeof html>[] = []
    let cards: Equipment[] = []
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
        push(renderSection(entry.group, entry.equipments))
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
        <input type="date" .value="${() => state.addCommissionedAt}" @input="${(e: Event) => { state.addCommissionedAt = (e.target as HTMLInputElement).value }}" />
      </div>
      <div class="toggle-row">
        <span class="toggle-row__label">This equipment has an hour-meter</span>
        <label class="toggle-switch">
          <input type="checkbox" .checked="${() => state.addTracksHours}" @change="${onToggleHours}" />
          <span class="toggle-slider"></span>
        </label>
      </div>
      ${() => state.addTracksHours ? html`
        <div class="form-field">
          <label class="form-field__label">Initial hours</label>
          <input type="number" min="0" .value="${() => String(state.addHours)}" @input="${(e: Event) => { state.addHours = Number((e.target as HTMLInputElement).value) }}" />
        </div>
      ` : null}
      <div class="modal__actions">
        <button class="btn" @click="${onCancelAdd}">Cancel</button>
        <button class="btn btn--accent" @click="${addEquipment}" disabled="${() => state.adding || !state.addName.trim()}">
          ${() => state.adding ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  </div>`

  return html`<section class="page">
    <div class="page__header">
      <h1>Equipments</h1>
      <button class="btn btn--accent" @click="${onAddClick}">+ Add equipment</button>
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

    <button class="fab" @click="${onAddClick}">+</button>
  </section>`
})
