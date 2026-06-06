import { component, html, reactive } from '@arrow-js/core'
import { Equipment } from '@generated/api/models/Equipment'
import { Task } from '@generated/api/models/Task'
import { Intervention } from '@generated/api/models/Intervention'
import { ModelFile } from '@generated/api/models/ModelFile'
import { EquipmentApi, TaskApi, InterventionApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { relativeTime, formatHours, formatDate, formatFileSize, isHoursVeryStale, dueRelative } from '@/lib/format'
import { FullInterventionModal } from '@/components/FullInterventionModal'

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
      quickPerformedBy: '',
      quickComments: '',
      quickSaving: false,
      quickError: null as string | null,

      showFullForm: false,
      editId: null as number | null,
      equipmentId: null as number | null,
      taskId: null as number | null,
      isExceptional: false,
      exceptionalLabel: '',
      date: '',
      hours: 0,
      location: '',
      performedBy: '',
      comments: '',
      saving: false,
      error: null as string | null,

      showHistoryDelete: false,
      historyDeleteTarget: null as Intervention | null,
      historyDeleteSaving: false,
      historyDeleteError: null as string | null,

      documents: [] as ModelFile[],
      documentsLoaded: false,
      documentsError: null as string | null,
      uploading: false,
      uploadError: null as string | null,
      showDeleteDoc: false,
      deleteDocName: '',
      deleteDocOriginal: '',
      deleteDocSaving: false,
      deleteDocError: null as string | null,
    })

    async function load() {
      try {
        const [eq, ts, interventionsResponse, allTs] = await Promise.all([
          equipmentApi.getEquipment({ id: equipmentId }),
          taskApi.listTasksByEquipment({ equipmentId }),
          interventionApi.listInterventions(),
          taskApi.listTasks(),
        ])

        const newTasks = ts.map((t: any) => ({
          ...t,
          nextDueDate: t.nextDueDate?.toISOString(),
          updatedAt: t.updatedAt?.toISOString(),
        }))

        const newAllTasks = allTs.map((t: any) => ({
          ...t,
          nextDueDate: t.nextDueDate?.toISOString(),
          updatedAt: t.updatedAt?.toISOString(),
        }))

        const taskIds = new Set(ts.map((t: Task) => t.id))
        const newInterventions = interventionsResponse.filter(
          (inv: Intervention) =>
            (inv.taskId != null && taskIds.has(inv.taskId)) ||
            (inv.taskId == null && inv.equipmentId === equipmentId)
        ).map((inv: any) => ({
          ...inv,
          date: inv.date?.toISOString(),
          createdAt: inv.createdAt?.toISOString(),
          updatedAt: inv.updatedAt?.toISOString(),
        }))

        const newEquipment = {
          ...eq,
          commissionedAt: eq.commissionedAt ? (eq.commissionedAt as any).toISOString().substring(0, 10) : undefined,
          hoursUpdatedAt: eq.hoursUpdatedAt?.toISOString(),
          createdAt: eq.createdAt?.toISOString(),
          updatedAt: eq.updatedAt?.toISOString(),
        } as Equipment

        state.tasks = newTasks
        state.allTasks = newAllTasks
        state.interventions = newInterventions
        state.equipment = newEquipment
      } catch {
        state.loadError = 'Failed to load equipment'
      } finally {
        state.loaded = true
      }
    }

    async function loadDocuments() {
      try {
        const files = await equipmentApi.listEquipmentFiles({ equipmentId })
        state.documents = files.map((f: any) => ({
          ...f,
          uploadedAt: f.uploadedAt?.toISOString?.() ?? f.uploadedAt,
        }))
        state.documentsError = null
      } catch {
        state.documentsError = 'Failed to load documents'
      } finally {
        state.documentsLoaded = true
      }
    }

    load()
    loadDocuments()

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
      { key: 'documents', label: 'Documents' },
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

    function onAddOverlayClick(e: Event) {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) onCancelAdd()
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

    function onEditOverlayClick(e: Event) {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) onCancelEdit()
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

    function onDeleteOverlayClick(e: Event) {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) onCancelDelete()
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
      state.quickPerformedBy = ''
      state.quickComments = ''
      state.quickError = null
    }

    function onCancelQuickLog() {
      state.showQuickLog = false
    }

    function onQuickLogOverlayClick(e: Event) {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) onCancelQuickLog()
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
            performedBy: state.quickPerformedBy.trim() || undefined,
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

    // ── Full Intervention Form ──

    function onAddFromHistory() {
      state.showFullForm = true
      state.editId = null
      state.equipmentId = equipmentId
      state.taskId = null
      state.isExceptional = false
      state.exceptionalLabel = ''
      state.date = new Date().toISOString().substring(0, 10)
      state.hours = state.equipment?.hours ?? 0
      state.location = ''
      state.performedBy = ''
      state.comments = ''
      state.saving = false
      state.error = null
    }

    function onEditFromHistory(inv: Intervention) {
      state.showFullForm = true
      state.editId = inv.id ?? null
      state.equipmentId = equipmentId
      state.taskId = inv.taskId ?? null
      state.isExceptional = inv.taskId == null
      state.exceptionalLabel = inv.exceptionalLabel ?? ''
      state.date = inv.date ? formatDate(inv.date) : ''
      state.hours = inv.hoursAt ?? 0
      state.location = inv.location ?? ''
      state.performedBy = inv.performedBy ?? ''
      state.comments = inv.comments ?? ''
      state.saving = false
      state.error = null
    }

    function onCancelFullForm() {
      state.showFullForm = false
    }

    function onFullFormOverlayClick(e: Event) {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) onCancelFullForm()
    }

    async function onSaveFullForm() {
      if (!state.date) return
      if (state.isExceptional && !state.exceptionalLabel.trim()) return
      if (!state.isExceptional && state.taskId == null) return
      state.saving = true
      state.error = null

      const body = state.isExceptional ? {
        equipmentId: equipmentId,
        exceptionalLabel: state.exceptionalLabel.trim(),
        date: new Date(state.date + 'T00:00:00'),
        hoursAt: tracksHours() ? state.hours : undefined,
        location: state.location.trim() || undefined,
        performedBy: state.performedBy.trim() || undefined,
        comments: state.comments.trim() || undefined,
      } : {
        taskId: state.taskId!,
        date: new Date(state.date + 'T00:00:00'),
        hoursAt: tracksHours() ? state.hours : undefined,
        location: state.location.trim() || undefined,
        performedBy: state.performedBy.trim() || undefined,
        comments: state.comments.trim() || undefined,
      }

      try {
        if (state.editId != null) {
          await interventionApi.updateIntervention({
            id: state.editId,
            interventionInput: body,
          })
        } else {
          await interventionApi.createIntervention({
            interventionInput: body,
          })
        }
        state.showFullForm = false
        await load()
      } catch {
        state.error = 'Failed to save intervention'
      } finally {
        state.saving = false
      }
    }

    function onHistoryDeleteClick(inv: Intervention) {
      state.showHistoryDelete = true
      state.historyDeleteTarget = inv
      state.historyDeleteError = null
    }

    function onCancelHistoryDelete() {
      state.showHistoryDelete = false
    }

    function onHistoryDeleteOverlayClick(e: Event) {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) onCancelHistoryDelete()
    }

    async function onConfirmHistoryDelete() {
      if (state.historyDeleteTarget == null || state.historyDeleteTarget.id == null) return
      state.historyDeleteSaving = true
      state.historyDeleteError = null
      try {
        await interventionApi.deleteIntervention({ id: state.historyDeleteTarget.id })
        state.showHistoryDelete = false
        await load()
      } catch {
        state.historyDeleteError = 'Failed to delete intervention'
      } finally {
        state.historyDeleteSaving = false
      }
    }

    // ── Documents ──

    async function onUploadChange(e: Event) {
      const input = e.target as HTMLInputElement
      const file = input.files?.[0]
      if (!file) return
      state.uploading = true
      state.uploadError = null
      try {
        await equipmentApi.uploadEquipmentFile({ equipmentId, file })
        await loadDocuments()
      } catch {
        state.uploadError = 'Failed to upload document'
      } finally {
        state.uploading = false
        input.value = ''
      }
    }

    function onDeleteDoc(f: ModelFile) {
      state.showDeleteDoc = true
      state.deleteDocName = f.name
      state.deleteDocOriginal = f.originalName
      state.deleteDocError = null
    }

    function onCancelDeleteDoc() {
      state.showDeleteDoc = false
    }

    function onDeleteDocOverlayClick(e: Event) {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) onCancelDeleteDoc()
    }

    async function onConfirmDeleteDoc() {
      if (!state.deleteDocName) return
      state.deleteDocSaving = true
      state.deleteDocError = null
      try {
        await equipmentApi.deleteEquipmentFile({ equipmentId, filename: state.deleteDocName })
        state.showDeleteDoc = false
        await loadDocuments()
      } catch {
        state.deleteDocError = 'Failed to delete document'
      } finally {
        state.deleteDocSaving = false
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
            ${eq.commissionedAt ? html`<div class="detail-header__meta">Commissioned ${formatDate(eq.commissionedAt)}</div>` : null}
          </div>

          <nav class="sub-tabs">${tabLinks}</nav>

          <div class="tab-content">
            ${() => currentTab === '' ? taskTabContent() : null}
            ${() => currentTab === 'history' ? historyTabContent() : null}
            ${() => currentTab === 'documents' ? documentsTabContent() : null}
            ${() => currentTab === 'info' ? infoTabContent() : null}
          </div>

          ${() => state.showAddTask ? addTaskModal() : null}
          ${() => state.showEditTask ? editTaskModal() : null}
          ${() => state.showDeleteTask ? deleteTaskModal() : null}
          ${() => state.showQuickLog ? quickLogModal() : null}
          ${() => state.showDeleteDoc ? deleteDocModal() : null}
          ${() => state.showFullForm ? FullInterventionModal(state as any, {
            equipments: () => [state.equipment!],
            allTasks: () => state.allTasks,
            equipmentIdFixed: equipmentId,
            title: state.editId != null ? 'Edit intervention' : 'Log intervention',
            onCancel: onCancelFullForm,
            onOverlayClick: onFullFormOverlayClick,
            onSave: onSaveFullForm,
          }) : null}

          ${() => state.showHistoryDelete ? html`
            <div class="modal-overlay" @click="${onHistoryDeleteOverlayClick}">
              <div class="modal">
                <h2 class="modal__title">Delete intervention</h2>
                ${() => state.historyDeleteError ? html`<div class="flash flash--error">${state.historyDeleteError}</div>` : null}
                <p class="confirm-text">Are you sure you want to delete this intervention? Equipment hours and task due dates will be recomputed from the remaining history.</p>
                <div class="modal__actions">
                  <button class="btn" @click="${onCancelHistoryDelete}">Cancel</button>
                  <button class="btn btn--danger" @click="${onConfirmHistoryDelete}" disabled="${() => state.historyDeleteSaving}">
                    ${() => state.historyDeleteSaving ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ` : null}
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
            ${() => tasks.map(t => {
              const lastInv = getLastIntervention(t.id)
              const parts: string[] = []
              if (t.hoursInterval) parts.push('Every ' + t.hoursInterval + 'h')
              if (t.monthsInterval) parts.push(t.monthsInterval + 'mo')
              const trigger = parts.join(' or ')
              const lastLabel = lastInv ? formatDate(lastInv.date) + (lastInv.hoursAt != null ? ' \u2022 ' + formatHours(lastInv.hoursAt) : '') : 'never'
              return html`<div class="task-row">
                <div class="task-row__info">
                  <p class="task-row__name">${t.name}</p>
                  <p class="task-row__interval">${trigger}</p>
                  <p class="task-row__meta">Last: ${lastLabel}</p>
                </div>
                <div class="task-row__actions">
                  ${() => {
                    const task = state.tasks.find(tt => tt.id === t.id)
                    const ds = task?.dueStatus ?? 'ok'
                    const relStr = dueRelative(task?.nextDueDate, task?.nextDueHours)
                    if (ds === 'overdue') return html`<span class="due-indicator due-indicator--overdue">Overdue \u2014 ${relStr}</span>`
                    if (ds === 'due_soon') return html`<span class="due-indicator due-indicator--due-soon">Due soon \u2014 ${relStr}</span>`
                    return html`<span class="due-indicator due-indicator--ok">OK</span>`
                  }}
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
      return html`
        <div class="tab-toolbar">
          <h2>History</h2>
          <button class="btn btn--accent" @click="${onAddFromHistory}">+ Log intervention</button>
        </div>
        ${() => {
          const sorted = [...state.interventions].sort((a, b) => {
            const da = a.date ? new Date(a.date) : null
            const db = b.date ? new Date(b.date) : null
            if (!da || !db) return 0
            return db.getTime() - da.getTime()
          })
          if (sorted.length === 0) {
            return html`<p class="page__empty">No history yet for this equipment.</p>`
          }
          return html`<div class="history-list">
            ${() => sorted.map(inv => {
              const dateStr = formatDate(inv.date)
              const taskLabel = inv.taskId == null ? (inv.exceptionalLabel ?? '') : getTaskName(inv.taskId)
              const itemClass = 'history-item' + (inv.taskId == null ? ' history-item--exceptional' : '')
              return html`<div class="${itemClass}">
                <div class="history-item__main">
                  <p class="history-item__task">${taskLabel}</p>
                  <p class="history-item__date">${dateStr}</p>
                  ${inv.hoursAt != null ? html`<p class="history-item__details">${formatHours(inv.hoursAt)}</p>` : null}
                  ${inv.location ? html`<p class="history-item__details">${inv.location}</p>` : null}
                  ${inv.performedBy ? html`<p class="history-item__details">${inv.performedBy}</p>` : null}
                  ${inv.comments ? html`<p class="history-item__details history-item__comments">${inv.comments}</p>` : null}
                </div>
                <div class="history-item__actions">
                  <button class="btn btn--small" @click="${() => onEditFromHistory(inv)}">Edit</button>
                  <button class="btn btn--small btn--danger" @click="${() => onHistoryDeleteClick(inv)}">Del</button>
                </div>
              </div>`
            })}
          </div>`
        }}
      `
    }

    function documentsTabContent() {
      return html`
        <div class="tab-toolbar">
          <h2>Documents</h2>
          <label class="btn btn--accent">
            ${() => state.uploading ? 'Uploading...' : '+ Upload document'}
            <input type="file" style="display: none" @change="${onUploadChange}" disabled="${() => state.uploading}" />
          </label>
        </div>
        ${() => state.uploadError ? html`<div class="flash flash--error">${state.uploadError}</div>` : null}
        ${() => {
          if (!state.documentsLoaded) return html`<p class="page__empty">Loading...</p>`
          if (state.documentsError) return html`<div class="flash flash--error">${state.documentsError}</div>`
          const docs = state.documents
          if (docs.length === 0) {
            return html`<p class="page__empty">No documents attached.
              <label class="upload-inline">+ Upload your first document<input type="file" style="display: none" @change="${onUploadChange}" /></label>
            </p>`
          }
          return html`<div class="doc-list">
            ${() => docs.map(f => html`<div class="doc-row">
              <div class="doc-row__info">
                <p class="doc-row__name">${f.originalName}</p>
                <p class="doc-row__meta">${formatFileSize(f.size)} • ${formatDate(f.uploadedAt)}</p>
              </div>
              <div class="doc-row__actions">
                <a class="btn btn--small" href="${f.url}" download="${f.originalName}">Download</a>
                <button class="btn btn--small btn--danger" @click="${() => onDeleteDoc(f)}">Delete</button>
              </div>
            </div>`)}
          </div>`
        }}
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
          ${eq.commissionedAt ? html`<div class="form-field">
            <label class="form-field__label">Date of commissioning</label>
            <p>${formatDate(eq.commissionedAt)}</p>
          </div>` : null}
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
        <div class="modal-overlay" @click="${onAddOverlayClick}">
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
        <div class="modal-overlay" @click="${onEditOverlayClick}">
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
        <div class="modal-overlay" @click="${onDeleteOverlayClick}">
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
        <div class="modal-overlay" @click="${onQuickLogOverlayClick}">
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
              <label class="form-field__label">Done by</label>
              <input placeholder="e.g. Self, Garage du Port" .value="${() => state.quickPerformedBy}" @input="${(e: Event) => { state.quickPerformedBy = (e.target as HTMLInputElement).value }}" />
            </div>
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

    function deleteDocModal() {
      return html`
        <div class="modal-overlay" @click="${onDeleteDocOverlayClick}">
          <div class="modal">
            <h2 class="modal__title">Delete file</h2>
            ${() => state.deleteDocError ? html`<div class="flash flash--error">${state.deleteDocError}</div>` : null}
            <p class="confirm-text">Delete <strong>${() => state.deleteDocOriginal}</strong>? This cannot be undone.</p>
            <div class="modal__actions">
              <button class="btn" @click="${onCancelDeleteDoc}">Cancel</button>
              <button class="btn btn--danger" @click="${onConfirmDeleteDoc}" disabled="${() => state.deleteDocSaving}">
                ${() => state.deleteDocSaving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>`
    }
  })()
}
