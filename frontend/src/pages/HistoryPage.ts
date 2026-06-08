import { component, html, reactive } from '@arrow-js/core'
import { Equipment } from '@generated/api/models/Equipment'
import { Task } from '@generated/api/models/Task'
import { Intervention } from '@generated/api/models/Intervention'
import { EquipmentApi, TaskApi, InterventionApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { formatDate, formatHours } from '@/lib/format'
import { FullInterventionModal } from '@/components/FullInterventionModal'

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)
const interventionApi = new InterventionApi(apiConfig)

export function HistoryPage() {
  return component(() => {
    const state = reactive({
      equipments: [] as Equipment[],
      tasks: [] as Task[],
      interventions: [] as Intervention[],
      loaded: false,
      loadError: null as string | null,

      filterEquipmentId: null as number | null,
      filterDateFrom: '',
      filterDateTo: '',

      showForm: false,
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

      showDeleteConfirm: false,
      deleteTarget: null as Intervention | null,
      deleteSaving: false,
      deleteError: null as string | null,
    })

    async function load() {
      try {
        const [eqs, ts, invs] = await Promise.all([
          equipmentApi.listEquipments(),
          taskApi.listTasks(),
          interventionApi.listInterventions(),
        ])

        state.equipments = eqs.map((e: any) => ({
          ...e,
          hoursUpdatedAt: e.hoursUpdatedAt?.toISOString(),
          createdAt: e.createdAt?.toISOString(),
          updatedAt: e.updatedAt?.toISOString(),
        }))

        state.tasks = ts.map((t: any) => ({
          ...t,
          nextDueDate: t.nextDueDate?.toISOString(),
          createdAt: t.createdAt?.toISOString(),
          updatedAt: t.updatedAt?.toISOString(),
        }))

        state.interventions = invs.map((inv: any) => ({
          ...inv,
          date: inv.date?.toISOString(),
          createdAt: inv.createdAt?.toISOString(),
          updatedAt: inv.updatedAt?.toISOString(),
        }))
      } catch {
        state.loadError = 'Failed to load history'
      } finally {
        state.loaded = true
      }
    }

    load()

    function getEquipmentForTask(taskId: number | undefined): Equipment | undefined {
      if (taskId == null) return undefined
      const task = state.tasks.find(t => t.id === taskId)
      if (!task || task.equipmentId == null) return undefined
      return state.equipments.find(e => e.id === task.equipmentId)
    }

    function getTask(taskId: number | undefined): Task | undefined {
      if (taskId == null) return undefined
      return state.tasks.find(t => t.id === taskId)
    }

    function sortedInterventions(): Intervention[] {
      let list = [...state.interventions]
      const filterEqId = state.filterEquipmentId
      const filterFrom = state.filterDateFrom
      const filterTo = state.filterDateTo

      if (filterEqId != null) {
        const taskIdsForEq = new Set(
          state.tasks.filter(t => t.equipmentId === filterEqId).map(t => t.id)
        )
        list = list.filter(inv =>
          (inv.taskId != null && taskIdsForEq.has(inv.taskId)) ||
          (inv.taskId == null && inv.equipmentId === filterEqId)
        )
      }

      if (filterFrom) {
        const fromDate = new Date(filterFrom + 'T00:00:00')
        list = list.filter(inv => inv.date && new Date(inv.date) >= fromDate)
      }

      if (filterTo) {
        const toDate = new Date(filterTo + 'T23:59:59')
        list = list.filter(inv => inv.date && new Date(inv.date) <= toDate)
      }

      list.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0
        const db = b.date ? new Date(b.date).getTime() : 0
        return db - da
      })

      return list
    }

    function resetForm() {
      state.editId = null
      state.equipmentId = null
      state.taskId = null
      state.isExceptional = false
      state.exceptionalLabel = ''
      state.date = new Date().toISOString().substring(0, 10)
      state.hours = 0
      state.location = ''
      state.performedBy = ''
      state.comments = ''
      state.saving = false
      state.error = null
    }

    function onAddClick() {
      resetForm()
      state.showForm = true
    }

    function onEditClick(inv: Intervention) {
      state.editId = inv.id ?? null
      state.equipmentId = null
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
      state.showForm = true
    }

    function onCancelForm() {
      state.showForm = false
    }

    function onFormOverlayClick(e: Event) {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) onCancelForm()
    }

    async function onSaveForm() {
      if (!state.date) return
      if (state.isExceptional && !state.exceptionalLabel.trim()) return
      if (!state.isExceptional && state.taskId == null) return
      state.saving = true
      state.error = null

      const body = state.isExceptional ? {
        equipmentId: state.equipmentId ?? undefined,
        exceptionalLabel: state.exceptionalLabel.trim(),
        date: new Date(state.date + 'T00:00:00'),
        hoursAt: state.hours > 0 ? state.hours : undefined,
        location: state.location.trim() || undefined,
        performedBy: state.performedBy.trim() || undefined,
        comments: state.comments.trim() || undefined,
      } : {
        taskId: state.taskId!,
        date: new Date(state.date + 'T00:00:00'),
        hoursAt: state.hours > 0 ? state.hours : undefined,
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
        state.showForm = false
        await load()
      } catch {
        state.error = 'Failed to save intervention'
      } finally {
        state.saving = false
      }
    }

    function onDeleteClick(inv: Intervention) {
      state.showDeleteConfirm = true
      state.deleteTarget = inv
      state.deleteError = null
    }

    function onCancelDelete() {
      state.showDeleteConfirm = false
    }

    function onDeleteOverlayClick(e: Event) {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) onCancelDelete()
    }

    async function onConfirmDelete() {
      if (state.deleteTarget == null || state.deleteTarget.id == null) return
      state.deleteSaving = true
      state.deleteError = null
      try {
        await interventionApi.deleteIntervention({ id: state.deleteTarget.id })
        state.showDeleteConfirm = false
        await load()
      } catch {
        state.deleteError = 'Failed to delete intervention'
      } finally {
        state.deleteSaving = false
      }
    }

    function onFilterEquipmentChange(e: Event) {
      const val = (e.target as HTMLSelectElement).value
      state.filterEquipmentId = val ? parseInt(val, 10) : null
    }

    function onFilterFromChange(e: Event) {
      state.filterDateFrom = (e.target as HTMLInputElement).value
    }

    function onFilterToChange(e: Event) {
      state.filterDateTo = (e.target as HTMLInputElement).value
    }

    return html`<section class="page">
      <div class="page__header">
        <h1>History</h1>
        <button class="btn btn--accent" @click="${onAddClick}">+ Log intervention</button>
      </div>

      ${() => {
        const loaded = state.loaded
        const loadError = state.loadError
        const equipments = state.equipments
        const filterEquipmentId = state.filterEquipmentId
        const filterDateFrom = state.filterDateFrom
        const filterDateTo = state.filterDateTo
        const interventions = state.interventions
        const tasks = state.tasks

        let listContent = null as ReturnType<typeof html> | null

        if (loaded && !loadError) {
          let list = [...interventions]
          if (filterEquipmentId != null) {
            const taskIdsForEq = new Set(tasks.filter(t => t.equipmentId === filterEquipmentId).map(t => t.id))
            list = list.filter(inv =>
              (inv.taskId != null && taskIdsForEq.has(inv.taskId)) ||
              (inv.taskId == null && inv.equipmentId === filterEquipmentId)
            )
          }
          if (filterDateFrom) {
            const fromDate = new Date(filterDateFrom + 'T00:00:00')
            list = list.filter(inv => inv.date && new Date(inv.date) >= fromDate)
          }
          if (filterDateTo) {
            const toDate = new Date(filterDateTo + 'T23:59:59')
            list = list.filter(inv => inv.date && new Date(inv.date) <= toDate)
          }
          list.sort((a, b) => {
            const da = a.date ? new Date(a.date).getTime() : 0
            const db = b.date ? new Date(b.date).getTime() : 0
            return db - da
          })

          if (list.length === 0) {
            listContent = equipments.length === 0
              ? html`<p class="page__empty">No interventions logged yet. Once you add equipments and mark tasks as done, they'll appear here.</p>`
              : html`<p class="page__empty">No interventions match your filters.</p>`
          } else {
            const currentList = list
            listContent = html`<div class="history-list">
              ${() => currentList.map(inv => {
                const dateStr = formatDate(inv.date)
                const parts: string[] = []
                if (inv.taskId == null) {
                  const eq = equipments.find((e: Equipment) => e.id === inv.equipmentId)
                  if (eq?.name) parts.push(eq.name)
                  if (inv.exceptionalLabel) parts.push(inv.exceptionalLabel)
                } else {
                  const eq = getEquipmentForTask(inv.taskId)
                  const task = getTask(inv.taskId)
                  if (eq?.name) parts.push(eq.name)
                  if (task?.name) parts.push(task.name)
                }
                const metaParts: string[] = []
                if (inv.hoursAt != null) metaParts.push(formatHours(inv.hoursAt))
                if (inv.location) metaParts.push(inv.location)
                if (inv.performedBy) metaParts.push(inv.performedBy)
                if (inv.comments) metaParts.push(inv.comments)
                if (inv.photoCount) metaParts.push('📷 ' + String(inv.photoCount) + (inv.photoCount === 1 ? ' photo' : ' photos'))
                const metaStr = metaParts.join(' · ')
                const itemClass = 'history-item' + (inv.taskId == null ? ' history-item--exceptional' : '')
                return html`<div class="${itemClass}">
                  <span class="history-item__date">${dateStr}</span>
                  <span class="history-item__task">${parts.join(' / ')}</span>
                  <span class="history-item__meta">${metaStr}</span>
                  <div class="history-item__actions">
                    <button class="btn btn--small" @click="${() => onEditClick(inv)}">Edit</button>
                    <button class="btn btn--small btn--danger" @click="${() => onDeleteClick(inv)}">Del</button>
                  </div>
                </div>`
              })}
            </div>`
          }
        }

        return html`<div class="history-body">
          <div class="history-filters">
            <div class="form-field">
              <select @change="${onFilterEquipmentChange}">
                <option value="">All equipments</option>
                ${() => equipments.map(eq => {
                  return filterEquipmentId === eq.id
                    ? html`<option value="${String(eq.id)}" selected="selected">${eq.name}</option>`
                    : html`<option value="${String(eq.id)}">${eq.name}</option>`
                })}
              </select>
            </div>
            <div class="form-field">
              <input type="date" value="${filterDateFrom}" @input="${onFilterFromChange}" placeholder="From" />
            </div>
            <div class="form-field">
              <input type="date" value="${filterDateTo}" @input="${onFilterToChange}" placeholder="To" />
            </div>
          </div>
          ${() => !loaded ? html`<p class="page__empty">Loading...</p>` : null}
          ${() => loadError ? html`<div class="flash flash--error">${loadError}</div>` : null}
          ${() => listContent}
        </div>`
      }}

      ${() => state.showForm ? FullInterventionModal(state as any, {
        equipments: () => state.equipments,
        allTasks: () => state.tasks,
        interventionId: state.editId,
        title: state.editId != null ? 'Edit intervention' : 'Log intervention',
        onCancel: onCancelForm,
        onOverlayClick: onFormOverlayClick,
        onSave: onSaveForm,
      }) : null}

      ${() => state.showDeleteConfirm ? html`
        <div class="modal-overlay" @click="${onDeleteOverlayClick}">
          <div class="modal">
            <h2 class="modal__title">Delete intervention</h2>
            ${() => state.deleteError ? html`<div class="flash flash--error">${state.deleteError}</div>` : null}
            <p class="confirm-text">Are you sure you want to delete this intervention? Equipment hours and task due dates will be recomputed from the remaining history.</p>
            <div class="modal__actions">
              <button class="btn" @click="${onCancelDelete}">Cancel</button>
              <button class="btn btn--danger" @click="${onConfirmDelete}" disabled="${() => state.deleteSaving}">
                ${() => state.deleteSaving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ` : null}
    </section>`
  })()
}
