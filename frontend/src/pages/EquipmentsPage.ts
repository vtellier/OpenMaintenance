import { component, html, reactive } from '@arrow-js/core'
import { Equipment } from '@generated/api/models/Equipment'
import { Task } from '@generated/api/models/Task'
import { Intervention } from '@generated/api/models/Intervention'
import { EquipmentApi, TaskApi, InterventionApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { relativeTime, formatHours, formatDate, isHoursVeryStale } from '@/lib/format'
import { equipmentAvatar } from '@/components/EquipmentAvatar'
import { iconPicker } from '@/components/IconPicker'

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)
const interventionApi = new InterventionApi(apiConfig)

export const EquipmentsPage = component(() => {
  const state = reactive({
    equipments: [] as Equipment[],
    tasksByEquipment: {} as Record<number, Task[]>,
    interventions: [] as Intervention[],
    loading: true,
    error: null as string | null,
    showAddModal: false,
    addName: '',
    addDesc: '',
    addIcon: '🔧',
    addCommissionedAt: '',
    addTracksHours: false,
    addHours: 0,
    adding: false,
    addError: null as string | null,
  })

  async function load() {
    state.loading = true
    state.error = null
    try {
      const [equipments, tasks, interventions] = await Promise.all([
        equipmentApi.listEquipments(),
        taskApi.listTasks(),
        interventionApi.listInterventions(),
      ])
      state.equipments = equipments.map((eq: any) => ({
        ...eq,
        hoursUpdatedAt: eq.hoursUpdatedAt?.toISOString(),
        createdAt: eq.createdAt?.toISOString(),
        updatedAt: eq.updatedAt?.toISOString(),
      }))
      state.interventions = interventions.map((inv: any) => ({
        ...inv,
        date: inv.date?.toISOString(),
        createdAt: inv.createdAt?.toISOString(),
        updatedAt: inv.updatedAt?.toISOString(),
      }))

      const grouped: Record<number, (Omit<Task, 'nextDueDate'> & { nextDueDate: string | undefined })[]> = {}
      for (const t of tasks) {
        const eid = t.equipmentId ?? 0
        if (!grouped[eid]) grouped[eid] = []
        grouped[eid].push({
          ...t,
          nextDueDate: t.nextDueDate?.toISOString(),
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

  function latestIntervention(equipmentId: number): Intervention | null {
    const tasks = state.tasksByEquipment[equipmentId] || []
    const taskIds = new Set(tasks.map((t: Task) => t.id))
    let latest: Intervention | null = null
    for (const inv of state.interventions) {
      if (inv.taskId != null && taskIds.has(inv.taskId)) {
        if (!latest || (inv.date && latest.date && inv.date > latest.date)) {
          latest = inv
        }
      }
    }
    return latest
  }

  function safeTaskDate(date: Date | string | undefined | null): Date | null {
    if (date == null) return null
    try {
      const d = new Date(date)
      return isNaN(d.getTime()) ? null : d
    } catch {
      return null
    }
  }

  function taskTimingText(task: Task, eq: Equipment): string {
    const d = safeTaskDate(task.nextDueDate)
    if (d) {
      const diffDays = Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
      if (task.dueStatus === 'overdue') {
        if (diffDays <= 0) return 'today'
        return diffDays + 'd ago'
      } else {
        const remaining = -diffDays
        if (remaining <= 0) return 'today'
        return 'in ' + remaining + 'd'
      }
    }
    if (task.nextDueHours != null && eq.hours != null) {
      if (task.dueStatus === 'overdue') {
        const over = Math.round(eq.hours - task.nextDueHours)
        if (over <= 0) return 'now'
        return over + ' h ago'
      } else {
        const remaining = Math.round(task.nextDueHours - eq.hours)
        if (remaining <= 0) return 'now'
        return 'in ' + remaining + ' h'
      }
    }
    return ''
  }

  function overdueScore(task: Task, eq: Equipment): number {
    const now = Date.now()
    const d = safeTaskDate(task.nextDueDate)
    if (d) return now - d.getTime()
    if (task.nextDueHours != null && eq.hours != null) return (eq.hours - task.nextDueHours) * 3600 * 1000
    return -Infinity
  }

  function dueSoonScore(task: Task, eq: Equipment): number {
    const now = Date.now()
    const d = safeTaskDate(task.nextDueDate)
    if (d) return d.getTime() - now
    if (task.nextDueHours != null && eq.hours != null) return (task.nextDueHours - eq.hours) * 3600 * 1000
    return Infinity
  }

  function cropText(s: string, maxLen = 30): string {
    const chars = [...s]
    return chars.length > maxLen ? chars.slice(0, maxLen).join('') + '…' : s
  }

  function taskName(id: number | undefined): string {
    for (const tasks of Object.values(state.tasksByEquipment)) {
      const t = tasks.find((tt: Task) => tt.id === id)
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
          commissionedAt: state.addCommissionedAt ? new Date(state.addCommissionedAt + 'T12:00:00') : undefined,
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
      await load()
    } catch (err) {
      state.addError = 'Failed to add equipment'
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
      metaHtml = 'Last: ' + taskName(lastInv.taskId) + ', ' + formatDate(lastInv.date)
    } else {
      metaHtml = 'No intervention yet'
    }

    const overdueTasks = tasks.filter((t: Task) => t.dueStatus === 'overdue')
    const dueSoonTasks = tasks.filter((t: Task) => t.dueStatus === 'due_soon')

    let statusLabel = ''
    let statusClass = ''
    let statusText = ''

    if (overdueTasks.length > 0) {
      statusLabel = 'Overdue'
      statusClass = 'due-indicator--overdue'
      if (overdueTasks.length === 1) {
        const t = overdueTasks[0]
        const timing = taskTimingText(t, eq)
        statusText = cropText(t.name || '') + (timing ? ' \u2014 ' + timing : '')
      } else {
        const worst = overdueTasks.reduce((a: Task, b: Task) => overdueScore(a, eq) >= overdueScore(b, eq) ? a : b)
        const timing = taskTimingText(worst, eq)
        statusText = overdueTasks.length + ' tasks' + (timing ? ' \u2014 oldest ' + timing : '')
      }
    } else if (dueSoonTasks.length > 0) {
      statusLabel = 'Due soon'
      statusClass = 'due-indicator--due-soon'
      if (dueSoonTasks.length === 1) {
        const t = dueSoonTasks[0]
        const timing = taskTimingText(t, eq)
        statusText = cropText(t.name || '') + (timing ? ' \u2014 ' + timing : '')
      } else {
        const soonest = dueSoonTasks.reduce((a: Task, b: Task) => dueSoonScore(a, eq) <= dueSoonScore(b, eq) ? a : b)
        const timing = taskTimingText(soonest, eq)
        statusText = dueSoonTasks.length + ' tasks' + (timing ? ' \u2014 soonest ' + timing : '')
      }
    } else if (tasks.length > 0) {
      statusLabel = 'OK'
      statusClass = 'due-indicator--ok'
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

    ${() => !state.loading && !state.error && state.equipments.length === 0
      ? html`<p class="page__empty">No equipments yet. <a href="#" @click="${onAddClick}">Add your first equipment</a>.</p>`
      : null}

    ${() => !state.loading && state.equipments.length > 0
      ? html`<div class="equipment-grid">
          ${state.equipments.map(eq => renderCard(eq))}
        </div>`
      : null}

    ${() => state.showAddModal ? addModalHtml : null}

    <button class="fab" @click="${onAddClick}">+</button>
  </section>`
})
