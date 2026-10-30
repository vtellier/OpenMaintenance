import { component, html, reactive } from '@arrow-js/core'
import { Equipment } from '@generated/api/models/Equipment'
import { Task } from '@generated/api/models/Task'
import { Intervention } from '@generated/api/models/Intervention'
import { FileInfo } from '@generated/api/models/FileInfo'
import { EquipmentApi, TaskApi, InterventionApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { formatHours, formatFileSize, buildInterventionMeta } from '@/lib/format'
import { dueTimingText } from '@/lib/dueTiming'
import { byUrgency } from '@/lib/urgency'
import { relativeTime, formatTimestampDate, isHoursVeryStale } from '@/lib/timestamp'
import { WithCalendarDates, formatCalendarDate, compareCalendarDates, fromApiDate, fromApiDateTime, toApiDate } from '@/lib/calendar-date'
import { FullInterventionModal } from '@/components/FullInterventionModal'
import { QuickLogModal } from '@/components/QuickLogModal'
import { InterventionFormSource } from '@/lib/interventionForm'
import { ReadingDoubt, readingDoubt } from '@/lib/readingDoubt'
import { readingQuestion } from '@/components/ReadingDoubtModal'
import { iconPicker, DEFAULT_ICON } from '@/components/IconPicker'

type EquipmentRow = WithCalendarDates<Equipment, 'commissionedAt'>
type TaskRow = WithCalendarDates<Task, 'nextDueDate' | 'currentExpiryDate'>
type TaskKind = 'interval' | 'expiry'
type InterventionRow = WithCalendarDates<Intervention, 'date' | 'expiryDate'>

function mapEquipment(eq: any): EquipmentRow {
  return {
    ...eq,
    commissionedAt: fromApiDate(eq.commissionedAt),
    hoursUpdatedAt: eq.hoursUpdatedAt?.toISOString(),
    createdAt: eq.createdAt?.toISOString(),
    updatedAt: eq.updatedAt?.toISOString(),
  }
}

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)
const interventionApi = new InterventionApi(apiConfig)

export function EquipmentDetailPage(idParam: string, tabParam: string) {
  const equipmentId = parseInt(idParam, 10)
  const currentTab = tabParam

  return component(() => {
    const state = reactive({
      equipment: null as EquipmentRow | null,
      tasks: [] as TaskRow[],
      interventions: [] as InterventionRow[],
      allTasks: [] as TaskRow[],
      loaded: false,
      loadError: null as string | null,
      showAddTask: false,
      addName: '',
      addDescription: '',
      addHoursInterval: 0,
      addMonthsInterval: 0,
      addKind: 'interval' as TaskKind,
      addCurrentExpiryDate: '',
      addSaving: false,
      addError: null as string | null,
      showEditTask: false,
      editTaskId: null as number | null,
      editName: '',
      editDescription: '',
      editHoursInterval: 0,
      editMonthsInterval: 0,
      editKind: 'interval' as TaskKind,
      editCurrentExpiryDate: '',
      /** The current expiry date is asked only while the task has no intervention. */
      editHasIntervention: false,
      editSaving: false,
      editError: null as string | null,
      showDeleteTask: false,
      deleteTaskId: null as number | null,
      deleteTaskName: '',
      deleteSaving: false,
      deleteError: null as string | null,
      quickLogOpen: false,

      fullFormOpen: false,

      showHistoryDelete: false,
      historyDeleteTarget: null as InterventionRow | null,
      historyDeleteSaving: false,
      historyDeleteError: null as string | null,

      iconError: null as string | null,

      documents: [] as FileInfo[],
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
          nextDueDate: fromApiDate(t.nextDueDate),
          currentExpiryDate: fromApiDate(t.currentExpiryDate),
          updatedAt: t.updatedAt?.toISOString(),
        }))

        const newAllTasks = allTs.map((t: any) => ({
          ...t,
          nextDueDate: fromApiDate(t.nextDueDate),
          currentExpiryDate: fromApiDate(t.currentExpiryDate),
          updatedAt: t.updatedAt?.toISOString(),
        }))

        const taskIds = new Set(ts.map((t: Task) => t.id))
        const newInterventions = interventionsResponse.filter(
          (inv: Intervention) =>
            (inv.taskId != null && taskIds.has(inv.taskId)) ||
            (inv.taskId == null && inv.equipmentId === equipmentId)
        ).map((inv: any) => ({
          ...inv,
          date: fromApiDateTime(inv.date),
          expiryDate: fromApiDate(inv.expiryDate),
          createdAt: inv.createdAt?.toISOString(),
          updatedAt: inv.updatedAt?.toISOString(),
        }))

        const newEquipment = mapEquipment(eq)

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

    function getLastIntervention(taskId: number | undefined): InterventionRow | null {
      if (taskId == null) return null
      let latest: InterventionRow | null = null
      for (const inv of state.interventions) {
        if (inv.taskId === taskId) {
          if (!latest || compareCalendarDates(inv.date, latest.date) > 0) {
            latest = inv
          }
        }
      }
      return latest
    }

    function getTaskName(taskId: number | undefined): string {
      const t = state.allTasks.find((tt: TaskRow) => tt.id === taskId)
      return t?.name || ''
    }

    function sortedTasks(): TaskRow[] {
      return [...state.tasks].sort(byUrgency)
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
      state.addKind = 'interval'
      state.addCurrentExpiryDate = ''
      state.addError = null
    }

    function onCancelAdd() {
      state.showAddTask = false
    }

    function onAddOverlayClick(e: Event) {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) onCancelAdd()
    }

    /** A name always; at least one interval for an interval task. An expiry task's current expiry date is optional. */
    function canSaveTask(name: string, kind: TaskKind, hoursInterval: number, monthsInterval: number): boolean {
      if (!name.trim()) return false
      return kind === 'expiry' || hoursInterval > 0 || monthsInterval > 0
    }

    /** The kind-specific fields of a task request: the intervals, or the current expiry date. */
    function kindFields(kind: TaskKind, hoursInterval: number, monthsInterval: number, currentExpiryDate: string) {
      if (kind === 'expiry') {
        return { hoursInterval: undefined, monthsInterval: undefined, currentExpiryDate: currentExpiryDate ? toApiDate(currentExpiryDate) : undefined }
      }
      return {
        hoursInterval: hoursInterval > 0 ? hoursInterval : undefined,
        monthsInterval: monthsInterval > 0 ? monthsInterval : undefined,
      }
    }

    async function onSaveAdd() {
      if (!canSaveTask(state.addName, state.addKind, state.addHoursInterval, state.addMonthsInterval)) return
      state.addSaving = true
      state.addError = null
      try {
        await taskApi.createTask({
          taskInput: {
            equipmentId,
            name: state.addName.trim(),
            description: state.addDescription.trim() || undefined,
            kind: state.addKind,
            ...kindFields(state.addKind, state.addHoursInterval, state.addMonthsInterval, state.addCurrentExpiryDate),
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

    function onEditTask(task: TaskRow) {
      state.showEditTask = true
      state.editTaskId = task.id ?? null
      state.editName = task.name ?? ''
      state.editDescription = task.description ?? ''
      state.editHoursInterval = task.hoursInterval ?? 0
      state.editMonthsInterval = task.monthsInterval ?? 0
      state.editKind = task.kind === 'expiry' ? 'expiry' : 'interval'
      state.editCurrentExpiryDate = task.currentExpiryDate ?? ''
      state.editHasIntervention = getLastIntervention(task.id) != null
      state.editError = null
    }

    function onCancelEdit() {
      state.showEditTask = false
    }

    function onEditOverlayClick(e: Event) {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) onCancelEdit()
    }

    async function onSaveEdit() {
      if (state.editTaskId == null) return
      if (!canSaveTask(state.editName, state.editKind, state.editHoursInterval, state.editMonthsInterval)) return
      state.editSaving = true
      state.editError = null
      try {
        await taskApi.updateTask({
          id: state.editTaskId,
          taskInput: {
            equipmentId,
            name: state.editName.trim(),
            description: state.editDescription.trim() || undefined,
            kind: state.editKind,
            ...kindFields(state.editKind, state.editHoursInterval, state.editMonthsInterval, state.editCurrentExpiryDate),
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

    function onDeleteTask(task: TaskRow) {
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

    // Built when opened, like the full form below.
    let quickLog: ReturnType<typeof QuickLogModal> | null = null

    function onQuickLog(task: TaskRow) {
      if (task.id == null) return
      quickLog = QuickLogModal({ id: task.id, name: task.name ?? '' }, {
        equipments: () => [state.equipment!],
        tasks: () => state.tasks,
        onClose: onCloseQuickLog,
        onSaved: onQuickLogSaved,
      })
      state.quickLogOpen = true
    }

    function onCloseQuickLog() {
      state.quickLogOpen = false
    }

    async function onQuickLogSaved() {
      state.quickLogOpen = false
      await load()
    }

    // ── Full Intervention Form ──

    // Built when opened, outside any reactive expression: the form prefills
    // from the page's data once, and a later change to that data does not
    // rebuild it and lose what the user typed.
    let fullForm: ReturnType<typeof FullInterventionModal> | null = null

    function openFullForm(source: InterventionFormSource) {
      fullForm = FullInterventionModal(source, {
        equipments: () => [state.equipment!],
        allTasks: () => state.allTasks,
        interventions: () => state.interventions,
        equipmentIdFixed: equipmentId,
        onClose: onCloseFullForm,
        onSaved: onFullFormSaved,
      })
      state.fullFormOpen = true
    }

    function onAddFromHistory() {
      openFullForm({ new: { equipmentId } })
    }

    function onEditFromHistory(inv: InterventionRow) {
      openFullForm({ edit: inv })
    }

    function onCloseFullForm() {
      state.fullFormOpen = false
    }

    async function onFullFormSaved(doubt: ReadingDoubt | null) {
      state.fullFormOpen = false
      await load()
      readingQ.ask(doubt)
    }

    // The question about the reading a delete or an edit may have set
    // (doc/gui/interventions.md).
    const readingQ = readingQuestion()

    function onHistoryDeleteClick(inv: InterventionRow) {
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
      const doubt = state.equipment == null ? null : readingDoubt(
        { deleted: state.historyDeleteTarget },
        { equipments: [state.equipment], tasks: state.allTasks, interventions: state.interventions },
      )
      try {
        await interventionApi.deleteIntervention({ id: state.historyDeleteTarget.id })
        state.showHistoryDelete = false
        await load()
        readingQ.ask(doubt)
      } catch {
        state.historyDeleteError = 'Failed to delete intervention'
      } finally {
        state.historyDeleteSaving = false
      }
    }

    // ── Icon ──

    async function onChangeIcon(icon: string) {
      const eq = state.equipment
      if (!eq || icon === eq.icon) return
      const prev = eq.icon
      state.iconError = null
      // Optimistic: reflect the new icon immediately, revert if the save fails.
      state.equipment = { ...eq, icon }
      try {
        await equipmentApi.updateEquipment({
          id: equipmentId,
          equipmentInput: {
            name: eq.name!,
            description: eq.description || undefined,
            icon,
            commissionedAt: eq.commissionedAt ? toApiDate(eq.commissionedAt) : undefined,
            tracksHours: eq.tracksHours,
          },
        })
      } catch {
        state.equipment = { ...eq, icon: prev }
        state.iconError = 'Failed to update icon'
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

    function onDeleteDoc(f: FileInfo) {
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
        const correctHoursHref = '/equipments/' + equipmentId + '/edit/hours/correct'

        return html`
          <div class="detail-header">
            <div class="detail-header__top">
              <div class="detail-header__title">
                ${iconPicker(() => state.equipment?.icon ?? DEFAULT_ICON, onChangeIcon, { variant: 'avatar' })}
                <h1>${eq.name}</h1>
              </div>
              <div class="detail-header__actions">
                ${eq.tracksHours ? html`<a href="${updateHoursHref}" class="btn">Update hours</a>` : null}
                ${eq.tracksHours ? html`<a href="${correctHoursHref}" class="btn">Correct reading</a>` : null}
                <a href="${editHref}" class="btn">Edit</a>
                <a href="${deleteHref}" class="btn">Delete</a>
              </div>
            </div>
            ${eq.tracksHours ? html`<div class="detail-header__hours">
              <span>${formatHours(eq.hours)}</span>
              <span class="${hoursClass}">\u2022 updated ${relativeTime(eq.hoursUpdatedAt)}</span>
            </div>` : null}
            ${eq.commissionedAt ? html`<div class="detail-header__meta">Commissioned ${formatCalendarDate(eq.commissionedAt)}</div>` : null}
            ${() => state.iconError ? html`<div class="flash flash--error">${state.iconError}</div>` : null}
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
          ${() => state.quickLogOpen ? quickLog : null}
          ${() => state.showDeleteDoc ? deleteDocModal() : null}
          ${() => state.fullFormOpen ? fullForm : null}
          ${readingQ.view}

          ${() => state.showHistoryDelete ? html`
            <div class="modal-overlay" @click="${onHistoryDeleteOverlayClick}">
              <div class="modal">
                <h2 class="modal__title">Delete intervention</h2>
                ${() => state.historyDeleteError ? html`<div class="flash flash--error">${state.historyDeleteError}</div>` : null}
                <p class="confirm-text">Are you sure you want to delete this intervention? Task due dates will be recomputed from the remaining history. The equipment's hour-meter reading is not lowered.</p>
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
              const trigger = t.kind === 'expiry' ? 'On expiry date' : parts.join(' or ')
              const lastLabel = lastInv ? formatCalendarDate(lastInv.date) + (lastInv.hoursAt != null ? ' \u2022 ' + formatHours(lastInv.hoursAt) : '') : 'never'
              return html`<div class="task-row">
                <div class="task-row__info">
                  <p class="task-row__name">${t.name}</p>
                  ${() => {
                    const task = state.tasks.find(tt => tt.id === t.id)
                    const ds = task?.dueStatus ?? 'ok'
                    const relStr = task ? dueTimingText(task) : ''
                    if (ds === 'overdue') return html`<p class="task-row__meta"><span class="due-indicator due-indicator--overdue">Overdue \u2014 ${relStr}</span></p>`
                    if (ds === 'due_soon') return html`<p class="task-row__meta"><span class="due-indicator due-indicator--due-soon">Due soon \u2014 ${relStr}</span></p>`
                    return html`<p class="task-row__meta"><span class="due-indicator due-indicator--ok">OK</span></p>`
                  }}
                  <p class="task-row__interval">${trigger}</p>
                  <p class="task-row__meta">Last: ${lastLabel}</p>
                </div>
                <div class="task-row__actions">
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
          const sorted = [...state.interventions].sort((a, b) => compareCalendarDates(b.date, a.date))
          if (sorted.length === 0) {
            return html`<p class="page__empty">No history yet for this equipment.</p>`
          }
          return html`<div class="history-list">
            <div class="history-header">
              <span class="history-item__date">Date</span>
              <span class="history-item__task">Task</span>
              <span class="history-item__meta">Details</span>
              <span class="history-item__actions-head"></span>
            </div>
            ${() => sorted.map(inv => {
              const dateStr = formatCalendarDate(inv.date)
              const taskLabel = inv.taskId == null ? (inv.exceptionalLabel ?? '') : getTaskName(inv.taskId)
              const metaStr = buildInterventionMeta(inv)
              return html`<div class="history-item">
                <span class="history-item__date">${dateStr}</span>
                <span class="history-item__task">${taskLabel}</span>
                <span class="history-item__meta" title="${metaStr}">${metaStr}</span>
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
                <p class="doc-row__meta">${formatFileSize(f.size)} • ${formatTimestampDate(f.uploadedAt)}</p>
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
          <div class="form-field">
            <label class="form-field__label">Icon</label>
            <p>${eq.icon || '🔧'} <span class="form-field__hint">— shown in lists and the dashboard</span></p>
          </div>
          ${eq.commissionedAt ? html`<div class="form-field">
            <label class="form-field__label">Date of commissioning</label>
            <p>${formatCalendarDate(eq.commissionedAt)}</p>
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
            <p>${formatTimestampDate(eq.createdAt)}</p>
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
            <fieldset class="form-field form-field--inline task-kind">
              <legend class="form-field__label">Kind</legend>
              <label class="form-field__checkbox-label">
                <input type="radio" name="task-kind" value="interval" checked="${() => state.addKind === 'interval'}" @change="${() => { state.addKind = 'interval' }}" />
                Interval
              </label>
              <label class="form-field__checkbox-label">
                <input type="radio" name="task-kind" value="expiry" checked="${() => state.addKind === 'expiry'}" @change="${() => { state.addKind = 'expiry' }}" />
                Expiry date
              </label>
            </fieldset>
            ${() => state.addKind === 'expiry' ? html`
              <div class="form-field">
                <label class="form-field__label">Current expiry date</label>
                <input type="date" aria-label="Current expiry date" .value="${() => state.addCurrentExpiryDate}" @input="${(e: Event) => { state.addCurrentExpiryDate = (e.target as HTMLInputElement).value }}" />
                <p class="form-field__hint">The date printed on the part fitted now. Leave empty if unknown.</p>
              </div>
            ` : html`
              <div>
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
              </div>
            `}
            <div class="modal__actions">
              <button class="btn" @click="${onCancelAdd}">Cancel</button>
              <button class="btn btn--accent" @click="${onSaveAdd}" disabled="${() => state.addSaving || !canSaveTask(state.addName, state.addKind, state.addHoursInterval, state.addMonthsInterval)}">
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
            <p class="form-field__hint">${() => state.editKind === 'expiry' ? 'Expiry task' : 'Interval task'}</p>
            ${() => state.editKind === 'expiry'
              ? (state.editHasIntervention ? null : html`
                <div class="form-field">
                  <label class="form-field__label">Current expiry date</label>
                  <input type="date" aria-label="Current expiry date" .value="${() => state.editCurrentExpiryDate}" @input="${(e: Event) => { state.editCurrentExpiryDate = (e.target as HTMLInputElement).value }}" />
                  <p class="form-field__hint">The date printed on the part fitted now. Leave empty if unknown.</p>
                </div>
              `)
              : html`
              <div>
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
              </div>
            `}
            <div class="modal__actions">
              <button class="btn" @click="${onCancelEdit}">Cancel</button>
              <button class="btn btn--accent" @click="${onSaveEdit}" disabled="${() => state.editSaving || !canSaveTask(state.editName, state.editKind, state.editHoursInterval, state.editMonthsInterval)}">
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
