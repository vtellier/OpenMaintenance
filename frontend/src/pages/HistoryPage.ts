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
      date: '',
      hours: 0,
      location: '',
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
        list = list.filter(inv => inv.taskId != null && taskIdsForEq.has(inv.taskId))
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
      state.date = new Date().toISOString().substring(0, 10)
      state.hours = 0
      state.location = ''
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
      state.date = inv.date ? formatDate(inv.date) : ''
      state.hours = inv.hoursAt ?? 0
      state.location = inv.location ?? ''
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
      if (state.taskId == null || !state.date) return
      state.saving = true
      state.error = null

      const body = {
        taskId: state.taskId,
        date: new Date(state.date + 'T00:00:00'),
        hoursAt: state.hours > 0 ? state.hours : undefined,
        location: state.location.trim() || undefined,
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
        if (!state.loaded) return html`<p class="page__empty">Loading...</p>`
        if (state.loadError) return html`<div class="flash flash--error">${state.loadError}</div>`

        return html`

          <div class="history-filters">
            <div class="form-field">
              <select .value="${() => state.filterEquipmentId != null ? String(state.filterEquipmentId) : ''}" @change="${onFilterEquipmentChange}">
                <option value="">All equipments</option>
                ${() => state.equipments.map(eq => html`<option value="${String(eq.id)}">${eq.name}</option>`)}
              </select>
            </div>
            <div class="form-field">
              <input type="date" .value="${() => state.filterDateFrom}" @input="${onFilterFromChange}" placeholder="From" />
            </div>
            <div class="form-field">
              <input type="date" .value="${() => state.filterDateTo}" @input="${onFilterToChange}" placeholder="To" />
            </div>
          </div>

          ${() => {
            const items = sortedInterventions()
            if (items.length === 0) {
              const hasEquipments = state.equipments.length > 0
              if (!hasEquipments) {
                return html`<p class="page__empty">
                  No interventions logged yet. Once you add equipments and mark tasks as done, they'll appear here.
                </p>`
              }
              return html`<p class="page__empty">No interventions match your filters.</p>`
            }

            return html`<div class="history-list">
              ${items.map(inv => {
                const eq = getEquipmentForTask(inv.taskId)
                const task = getTask(inv.taskId)
                const dateStr = formatDate(inv.date)
                const parts: string[] = []
                if (eq?.name) parts.push(eq.name)
                if (task?.name) parts.push(task.name)
                return html`<div class="history-item">
                  <div class="history-item__main">
                    <p class="history-item__date">${dateStr}</p>
                    <p class="history-item__task">${parts.join(' / ')}</p>
                    ${inv.hoursAt != null ? html`<p class="history-item__details">${formatHours(inv.hoursAt)}</p>` : null}
                    ${inv.location ? html`<p class="history-item__details">${inv.location}</p>` : null}
                    ${inv.comments ? html`<p class="history-item__details history-item__comments">${inv.comments}</p>` : null}
                  </div>
                  <div class="history-item__actions">
                    <button class="btn btn--small" @click="${() => onEditClick(inv)}">Edit</button>
                    <button class="btn btn--small btn--danger" @click="${() => onDeleteClick(inv)}">Del</button>
                  </div>
                </div>`
              })}
            </div>`
          }}
        `
      }}

      ${() => state.showForm ? FullInterventionModal(state as any, {
        equipments: () => state.equipments,
        allTasks: () => state.tasks,
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
