import { component, html, reactive } from '@arrow-js/core'
import { Equipment } from '@generated/api/models/Equipment'
import { Task } from '@generated/api/models/Task'
import { Intervention } from '@generated/api/models/Intervention'
import { EquipmentApi, TaskApi, InterventionApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { relativeTime, formatHours, formatDate, isHoursVeryStale, dueRelative } from '@/lib/format'

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)
const interventionApi = new InterventionApi(apiConfig)

export function EquipmentDetailPage(idParam: string, tabParam: string) {
  const equipmentId = parseInt(idParam, 10)
  const currentTab = tabParam

  return component(() => {
    const state = reactive({
      equipment: null as Equipment | null,
      tasks: [] as Task[],
      interventions: [] as Intervention[],
      allTasks: [] as Task[],
      loaded: false,
      loadError: null as string | null,
      showAddTask: false,
      addName: '',
      addDescription: '',
      addHoursInterval: 0,
      addMonthsInterval: 0,
      addSaving: false,
      addError: null as string | null,
      showEditTask: false,
      editTaskId: null as number | null,
      editName: '',
      editDescription: '',
      editHoursInterval: 0,
      editMonthsInterval: 0,
      editSaving: false,
      editError: null as string | null,
      showDeleteTask: false,
      deleteTaskId: null as number | null,
      deleteTaskName: '',
      deleteSaving: false,
      deleteError: null as string | null,
      showQuickLog: false,
      quickTaskId: null as number | null,
      quickTaskName: '',
      quickDate: '',
      quickHours: 0,
      quickComments: '',
      quickSaving: false,
      quickError: null as string | null,
    })

    async function load() {
      try {
        const [eq, ts, interventionsResponse, allTs] = await Promise.all([
          equipmentApi.getEquipment({ id: equipmentId }),
          taskApi.listTasksByEquipment({ equipmentId }),
          interventionApi.listInterventions(),
          taskApi.listTasks(),
        ])
        state.equipment = eq
        state.tasks = ts
        state.allTasks = allTs
        const taskIds = new Set(ts.map((t: Task) => t.id))
        state.interventions = interventionsResponse.filter(
          (inv: Intervention) => inv.taskId != null && taskIds.has(inv.taskId)
        )
      } catch {
        state.loadError = 'Failed to load equipment'
      } finally {
        state.loaded = true
      }
    }

    load()

    function getLastIntervention(taskId: number | undefined): Intervention | null {
      if (taskId == null) return null
      let latest: Intervention | null = null
      for (const inv of state.interventions) {
        if (inv.taskId === taskId) {
          if (!latest || (inv.date && latest.date && inv.date > latest.date)) {
            latest = inv
          }
        }
      }
      return latest
    }

    function getTaskName(taskId: number | undefined): string {
      const t = state.allTasks.find((tt: Task) => tt.id === taskId)
      return t?.name || ''
    }

    function sortedTasks(): Task[] {
      const order = { overdue: 0, due_soon: 1, ok: 2 }
      return [...state.tasks].sort((a, b) => {
        return (order[a.dueStatus as keyof typeof order] ?? 2) - (order[b.dueStatus as keyof typeof order] ?? 2)
      })
    }

    const tracksHours = () => state.equipment?.tracksHours ?? false
    const hoursVal = () => state.equipment?.hours ?? 0
    const hoursUpdatedAt = () => state.equipment?.hoursUpdatedAt ?? null

    const tabs = [
      { key: '', label: 'Tasks' },
      { key: 'history', label: 'History' },
      { key: 'info', label: 'Info' },
    ]

    const tabLinks = tabs.map(t => {
      const tabPath = '/equipments/' + equipmentId + (t.key ? '/' + t.key : '')
      const tabClass = 'sub-tab' + (currentTab === t.key ? ' active' : '')
      return html`<a href="${tabPath}" class="${tabClass}">${t.label}</a>`
    })

    // ── Add Task ──

    function onAddTask() {
      state.showAddTask = true
      state.addName = ''
      state.addDescription = ''
      state.addHoursInterval = 0
      state.addMonthsInterval = 0
      state.addError = null
    }

    function onCancelAdd() {
      state.showAddTask = false
    }

    async function onSaveAdd() {
      if (!state.addName.trim()) return
      if (state.addHoursInterval <= 0 && state.addMonthsInterval <= 0) return
      state.addSaving = true
      state.addError = null
      try {
        await taskApi.createTask({
          taskInput: {
            equipmentId,
            name: state.addName.trim(),
            description: state.addDescription.trim() || undefined,
            hoursInterval: state.addHoursInterval > 0 ? state.addHoursInterval : undefined,
            monthsInterval: state.addMonthsInterval > 0 ? state.addMonthsInterval : undefined,
          },
        })
        state.showAddTask = false
        await load()
      } catch {
        state.addError = 'Failed to add task'
      } finally {
        state.addSaving = false
      }
    }

    // ── Edit Task ──

    function onEditTask(task: Task) {
      state.showEditTask = true
      state.editTaskId = task.id ?? null
      state.editName = task.name ?? ''
      state.editDescription = task.description ?? ''
      state.editHoursInterval = task.hoursInterval ?? 0
      state.editMonthsInterval = task.monthsInterval ?? 0
      state.editError = null
    }

    function onCancelEdit() {
      state.showEditTask = false
    }

    async function onSaveEdit() {
      if (!state.editName.trim() || state.editTaskId == null) return
      if (state.editHoursInterval <= 0 && state.editMonthsInterval <= 0) return
      state.editSaving = true
      state.editError = null
      try {
        await taskApi.updateTask({
          id: state.editTaskId,
          taskInput: {
            equipmentId,
            name: state.editName.trim(),
            description: state.editDescription.trim() || undefined,
            hoursInterval: state.editHoursInterval > 0 ? state.editHoursInterval : undefined,
            monthsInterval: state.editMonthsInterval > 0 ? state.editMonthsInterval : undefined,
          },
        })
        state.showEditTask = false
        await load()
      } catch {
        state.editError = 'Failed to update task'
      } finally {
        state.editSaving = false
      }
    }

    // ── Delete Task ──

    function onDeleteTask(task: Task) {
      state.showDeleteTask = true
      state.deleteTaskId = task.id ?? null
      state.deleteTaskName = task.name ?? ''
      state.deleteError = null
    }

    function onCancelDelete() {
      state.showDeleteTask = false
    }

    async function onConfirmDelete() {
      if (state.deleteTaskId == null) return
      state.deleteSaving = true
      state.deleteError = null
      try {
        await taskApi.deleteTask({ id: state.deleteTaskId })
        state.showDeleteTask = false
        await load()
      } catch {
        state.deleteError = 'Failed to delete task'
      } finally {
        state.deleteSaving = false
      }
    }

    // ── Quick Log ──

    function onQuickLog(task: Task) {
      state.showQuickLog = true
      state.quickTaskId = task.id ?? null
      state.quickTaskName = task.name ?? ''
      state.quickDate = new Date().toISOString().substring(0, 10)
      state.quickHours = state.equipment?.hours ?? 0
      state.quickComments = ''
      state.quickError = null
    }

    function onCancelQuickLog() {
      state.showQuickLog = false
    }

    async function onSaveQuickLog() {
      if (state.quickTaskId == null || !state.quickDate) return
      state.quickSaving = true
      state.quickError = null
      try {
        await interventionApi.createIntervention({
          interventionInput: {
            taskId: state.quickTaskId,
            date: new Date(state.quickDate + 'T00:00:00'),
            hoursAt: tracksHours() ? state.quickHours : undefined,
            comments: state.quickComments.trim() || undefined,
          },
        })
        state.showQuickLog = false
        await load()
      } catch {
        state.quickError = 'Failed to save intervention'
      } finally {
        state.quickSaving = false
      }
    }

    // ── Templates ──

    return html`<section class="page">
      <a href="/equipments" class="back-link">&larr; Back to equipments</a>

      ${() => {
        if (!state.loaded) return html`<p class="page__empty">Loading...</p>`
        if (state.loadError) return html`<div class="flash flash--error">${state.loadError}</div>`
        if (!state.equipment) return html`<p class="page__empty">Equipment not found.</p>`

        const eq = state.equipment
        const hoursClass = isHoursVeryStale(eq.hoursUpdatedAt) ? 'very-stale' : ''
        const editHref = '/equipments/' + equipmentId + '/edit'
        const deleteHref = '/equipments/' + equipmentId + '/delete'
        const updateHoursHref = '/equipments/' + equipmentId + '/edit/hours'

        return html`
          <div class="detail-header">
            <div class="detail-header__top">
              <div class="detail-header__title">
                <h1>${eq.name}</h1>
              </div>
              <div class="detail-header__actions">
                ${eq.tracksHours ? html`<a href="${updateHoursHref}" class="btn">Update hours</a>` : null}
                <a href="${editHref}" class="btn">Edit</a>
                <a href="${deleteHref}" class="btn">Delete</a>
              </div>
            </div>
            ${eq.tracksHours ? html`<div class="detail-header__hours">
              <span>${formatHours(eq.hours)}</span>
              <span class="${hoursClass}">\u2022 updated ${relativeTime(eq.hoursUpdatedAt)}</span>
            </div>` : null}
          </div>

          <nav class="sub-tabs">${tabLinks}</nav>

          <div class="tab-content">
            ${currentTab === '' ? taskTabContent() : null}
            ${currentTab === 'history' ? historyTabContent() : null}
            ${currentTab === 'info' ? infoTabContent() : null}
          </div>

          ${() => state.showAddTask ? addTaskModal() : null}
          ${() => state.showEditTask ? editTaskModal() : null}
          ${() => state.showDeleteTask ? deleteTaskModal() : null}
          ${() => state.showQuickLog ? quickLogModal() : null}
        `
      }}
    </section>`

    // ── Tab content renderers ──

    function taskTabContent() {
      return html`
        <div class="tab-toolbar">
          <h2>Tasks</h2>
          <button class="btn btn--accent" @click="${onAddTask}">+ Add task</button>
        </div>
        ${() => {
          const tasks = sortedTasks()
          if (tasks.length === 0) {
            return html`<p class="page__empty">No maintenance tasks yet for this equipment. <a href="#" @click="${onAddTask}">Add the first task</a>.</p>`
          }
          return html`<div class="task-list-compact">
            ${tasks.map(t => {
              const lastInv = getLastIntervention(t.id)
              const parts: string[] = []
              if (t.hoursInterval) parts.push('Every ' + t.hoursInterval + 'h')
              if (t.monthsInterval) parts.push('Every ' + t.monthsInterval + 'mo')
              const trigger = parts.join(' or ')
              const lastLabel = lastInv ? formatDate(lastInv.date) + (lastInv.hoursAt != null ? ' \u2022 ' + formatHours(lastInv.hoursAt) : '') : 'never'
              const dueClass = 'due-indicator due-indicator--' + (t.dueStatus === 'overdue' ? 'overdue' : t.dueStatus === 'due_soon' ? 'due-soon' : 'ok')
              const dueLabel = t.dueStatus === 'overdue' ? 'Overdue' : t.dueStatus === 'due_soon' ? 'Due soon' : 'OK'
              const dueRelativeStr = dueRelative(t.nextDueDate, t.nextDueHours)
              return html`<div class="task-row">
                <div class="task-row__info">
                  <p class="task-row__name">${t.name}</p>
                  <p class="task-row__interval">${trigger}</p>
                  <p class="task-row__meta">Last: ${lastLabel}</p>
                </div>
                <div class="task-row__actions">
                  <span class="${dueClass}">${dueClass.indexOf('--ok') >= 0 ? dueLabel : dueLabel + ' \u2014 ' + dueRelativeStr}</span>
                  <button class="btn btn--small" @click="${() => onQuickLog(t)}">Done</button>
                  <button class="btn btn--small" @click="${() => onEditTask(t)}">Edit</button>
                  <button class="btn btn--small btn--danger" @click="${() => onDeleteTask(t)}">Del</button>
                </div>
              </div>`
            })}
          </div>`
        }}
      `
    }

    function historyTabContent() {
      const sorted = [...state.interventions].sort((a, b) => {
        const da = a.date ? new Date(Number(a.date)) : null
        const db = b.date ? new Date(Number(b.date)) : null
        if (!da || !db) return 0
        return db.getTime() - da.getTime()
      })
      return html`
        ${sorted.length === 0
          ? html`<p class="page__empty">No interventions recorded yet.</p>`
          : html`<div class="history-list">
            ${sorted.map(inv => {
              const dateStr = formatDate(inv.date)
              const hoursStr = inv.hoursAt != null ? ' \u2022 ' + formatHours(inv.hoursAt) : ''
              return html`<div class="history-item">
                <p class="history-item__task">${getTaskName(inv.taskId)}</p>
                <p class="history-item__date">${dateStr}${hoursStr}</p>
                ${inv.location ? html`<p class="history-item__details">${inv.location}</p>` : null}
                ${inv.comments ? html`<p class="history-item__details">${inv.comments}</p>` : null}
              </div>`
            })}
          </div>`
        }
      `
    }

    function infoTabContent() {
      const eq = state.equipment
      if (!eq) return null
      return html`
        <div class="info-tab">
          <div class="form-field">
            <label class="form-field__label">Name</label>
            <p>${eq.name}</p>
          </div>
          <div class="form-field">
            <label class="form-field__label">Description</label>
            <p>${eq.description || 'None'}</p>
          </div>
          <div class="toggle-row">
            <span class="toggle-row__label">Hour-meter tracking</span>
            <span>${eq.tracksHours ? 'Enabled' : 'Disabled'}</span>
          </div>
          ${eq.tracksHours ? html`<div class="form-field">
            <label class="form-field__label">Current hours</label>
            <p>${formatHours(eq.hours)}</p>
          </div>` : null}
          <div class="form-field">
            <label class="form-field__label">Created</label>
            <p>${formatDate(eq.createdAt)}</p>
          </div>
        </div>
      `
    }

    // ── Modal templates ──

    function addTaskModal() {
      return html`
        <div class="modal-overlay" @click="${onCancelAdd}">
          <div class="modal">
            <h2 class="modal__title">Add task</h2>
            ${() => state.addError ? html`<div class="flash flash--error">${state.addError}</div>` : null}
            <div class="form-field">
              <label class="form-field__label">Name *</label>
              <input placeholder="e.g. Oil change" .value="${() => state.addName}" @input="${(e: Event) => { state.addName = (e.target as HTMLInputElement).value }}" />
            </div>
            <div class="form-field">
              <label class="form-field__label">Description</label>
              <textarea placeholder="Optional" .value="${() => state.addDescription}" @input="${(e: Event) => { state.addDescription = (e.target as HTMLTextAreaElement).value }}"></textarea>
            </div>
            ${() => tracksHours() ? html`
              <div class="form-field">
                <label class="form-field__label">Hours interval</label>
                <input type="number" min="1" placeholder="e.g. 100" .value="${() => state.addHoursInterval > 0 ? String(state.addHoursInterval) : ''}" @input="${(e: Event) => { state.addHoursInterval = parseInt((e.target as HTMLInputElement).value) || 0 }}" />
              </div>
            ` : null}
            <div class="form-field">
              <label class="form-field__label">Months interval</label>
              <input type="number" min="1" placeholder="e.g. 6" .value="${() => state.addMonthsInterval > 0 ? String(state.addMonthsInterval) : ''}" @input="${(e: Event) => { state.addMonthsInterval = parseInt((e.target as HTMLInputElement).value) || 0 }}" />
            </div>
            <div class="modal__actions">
              <button class="btn" @click="${onCancelAdd}">Cancel</button>
              <button class="btn btn--accent" @click="${onSaveAdd}" disabled="${() => state.addSaving || !state.addName.trim() || (state.addHoursInterval <= 0 && state.addMonthsInterval <= 0)}">
                ${() => state.addSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>`
    }

    function editTaskModal() {
      return html`
        <div class="modal-overlay" @click="${onCancelEdit}">
          <div class="modal">
            <h2 class="modal__title">Edit task</h2>
            ${() => state.editError ? html`<div class="flash flash--error">${state.editError}</div>` : null}
            <div class="form-field">
              <label class="form-field__label">Name *</label>
              <input placeholder="e.g. Oil change" .value="${() => state.editName}" @input="${(e: Event) => { state.editName = (e.target as HTMLInputElement).value }}" />
            </div>
            <div class="form-field">
              <label class="form-field__label">Description</label>
              <textarea placeholder="Optional" .value="${() => state.editDescription}" @input="${(e: Event) => { state.editDescription = (e.target as HTMLTextAreaElement).value }}"></textarea>
            </div>
            ${() => tracksHours() ? html`
              <div class="form-field">
                <label class="form-field__label">Hours interval</label>
                <input type="number" min="1" placeholder="e.g. 100" .value="${() => state.editHoursInterval > 0 ? String(state.editHoursInterval) : ''}" @input="${(e: Event) => { state.editHoursInterval = parseInt((e.target as HTMLInputElement).value) || 0 }}" />
              </div>
            ` : null}
            <div class="form-field">
              <label class="form-field__label">Months interval</label>
              <input type="number" min="1" placeholder="e.g. 6" .value="${() => state.editMonthsInterval > 0 ? String(state.editMonthsInterval) : ''}" @input="${(e: Event) => { state.editMonthsInterval = parseInt((e.target as HTMLInputElement).value) || 0 }}" />
            </div>
            <div class="modal__actions">
              <button class="btn" @click="${onCancelEdit}">Cancel</button>
              <button class="btn btn--accent" @click="${onSaveEdit}" disabled="${() => state.editSaving || !state.editName.trim() || (state.editHoursInterval <= 0 && state.editMonthsInterval <= 0)}">
                ${() => state.editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>`
    }

    function deleteTaskModal() {
      return html`
        <div class="modal-overlay" @click="${onCancelDelete}">
          <div class="modal">
            <h2 class="modal__title">Delete task</h2>
            ${() => state.deleteError ? html`<div class="flash flash--error">${state.deleteError}</div>` : null}
            <p class="confirm-text">Are you sure you want to delete <strong>${() => state.deleteTaskName}</strong>? All interventions recorded for this task will also be deleted.</p>
            <div class="modal__actions">
              <button class="btn" @click="${onCancelDelete}">Cancel</button>
              <button class="btn btn--danger" @click="${onConfirmDelete}" disabled="${() => state.deleteSaving}">
                ${() => state.deleteSaving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>`
    }

    function quickLogModal() {
      return html`
        <div class="modal-overlay" @click="${onCancelQuickLog}">
          <div class="modal">
            <h2 class="modal__title">Mark done: ${() => state.quickTaskName}</h2>
            ${() => state.quickError ? html`<div class="flash flash--error">${state.quickError}</div>` : null}
            <div class="form-field">
              <label class="form-field__label">Date *</label>
              <input type="date" .value="${() => state.quickDate}" @input="${(e: Event) => { state.quickDate = (e.target as HTMLInputElement).value }}" />
            </div>
            ${() => tracksHours() ? html`
              <div class="form-field">
                <label class="form-field__label">Hours</label>
                <input type="number" min="0" .value="${() => String(state.quickHours)}" @input="${(e: Event) => { state.quickHours = Number((e.target as HTMLInputElement).value) }}" />
              </div>
            ` : null}
            <div class="form-field">
              <label class="form-field__label">Notes</label>
              <input placeholder="Optional" .value="${() => state.quickComments}" @input="${(e: Event) => { state.quickComments = (e.target as HTMLInputElement).value }}" />
            </div>
            <div class="modal__actions">
              <button class="btn" @click="${onCancelQuickLog}">Cancel</button>
              <button class="btn btn--accent" @click="${onSaveQuickLog}" disabled="${() => state.quickSaving || !state.quickDate}">
                ${() => state.quickSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>`
    }
  })()
}
