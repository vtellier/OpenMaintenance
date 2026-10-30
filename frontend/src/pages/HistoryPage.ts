import { component, html, reactive } from '@arrow-js/core'
import { Equipment } from '@generated/api/models/Equipment'
import { Task } from '@generated/api/models/Task'
import { Intervention } from '@generated/api/models/Intervention'
import { EquipmentApi, TaskApi, InterventionApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { buildInterventionMeta } from '@/lib/format'
import { WithCalendarDates, formatCalendarDate, compareCalendarDates, fromApiDate, fromApiDateTime } from '@/lib/calendar-date'
import { FullInterventionModal } from '@/components/FullInterventionModal'
import { InterventionFormSource } from '@/lib/interventionForm'
import { ReadingDoubt, readingDoubt } from '@/lib/readingDoubt'
import { readingQuestion } from '@/components/ReadingDoubtModal'

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)
const interventionApi = new InterventionApi(apiConfig)

type InterventionRow = WithCalendarDates<Intervention, 'date' | 'expiryDate'>

export function HistoryPage() {
  return component(() => {
    const state = reactive({
      equipments: [] as Equipment[],
      tasks: [] as Task[],
      interventions: [] as InterventionRow[],
      loaded: false,
      loadError: null as string | null,

      filterEquipmentId: null as number | null,
      filterDateFrom: '',
      filterDateTo: '',

      formOpen: false,

      showDeleteConfirm: false,
      deleteTarget: null as InterventionRow | null,
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
          date: fromApiDateTime(inv.date),
          expiryDate: fromApiDate(inv.expiryDate),
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

    // Built when opened, outside any reactive expression: the form prefills
    // from the page's data once, and a later change to that data does not
    // rebuild it and lose what the user typed.
    let form: ReturnType<typeof FullInterventionModal> | null = null

    function openForm(source: InterventionFormSource) {
      form = FullInterventionModal(source, {
        equipments: () => state.equipments,
        allTasks: () => state.tasks,
        interventions: () => state.interventions,
        onClose: onCloseForm,
        onSaved: onFormSaved,
      })
      state.formOpen = true
    }

    function onAddClick() {
      openForm({ new: { equipmentId: null } })
    }

    function onEditClick(inv: InterventionRow) {
      openForm({ edit: inv })
    }

    function onCloseForm() {
      state.formOpen = false
    }

    async function onFormSaved(doubt: ReadingDoubt | null) {
      state.formOpen = false
      await load()
      readingQ.ask(doubt, state.equipments)
    }

    // The question about the reading a delete or an edit may have set
    // (doc/gui/interventions.md).
    const readingQ = readingQuestion()

    function onDeleteClick(inv: InterventionRow) {
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
      const doubt = readingDoubt(
        { deleted: state.deleteTarget },
        { equipments: state.equipments, tasks: state.tasks, interventions: state.interventions },
      )
      try {
        await interventionApi.deleteIntervention({ id: state.deleteTarget.id })
        state.showDeleteConfirm = false
        await load()
        readingQ.ask(doubt, state.equipments)
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
          // Calendar dates ('YYYY-MM-DD') compare in calendar order.
          if (filterDateFrom) {
            list = list.filter(inv => inv.date != null && inv.date >= filterDateFrom)
          }
          if (filterDateTo) {
            list = list.filter(inv => inv.date != null && inv.date <= filterDateTo)
          }
          list.sort((a, b) => compareCalendarDates(b.date, a.date))

          if (list.length === 0) {
            listContent = equipments.length === 0
              ? html`<p class="page__empty">No interventions logged yet. Once you add equipments and mark tasks as done, they'll appear here.</p>`
              : html`<p class="page__empty">No interventions match your filters.</p>`
          } else {
            const currentList = list
            listContent = html`<div class="history-list">
              <div class="history-header">
                <span class="history-item__date">Date</span>
                <span class="history-item__task">Equipment / Task</span>
                <span class="history-item__meta">Details</span>
                <span class="history-item__actions-head"></span>
              </div>
              ${() => currentList.map(inv => {
                const dateStr = formatCalendarDate(inv.date)
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
                const metaStr = buildInterventionMeta(inv)
                return html`<div class="history-item">
                  <span class="history-item__date">${dateStr}</span>
                  <span class="history-item__task">${parts.join(' / ')}</span>
                  <span class="history-item__meta" title="${metaStr}">${metaStr}</span>
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

      ${() => state.formOpen ? form : null}
      ${readingQ.view}

      ${() => state.showDeleteConfirm ? html`
        <div class="modal-overlay" @click="${onDeleteOverlayClick}">
          <div class="modal">
            <h2 class="modal__title">Delete intervention</h2>
            ${() => state.deleteError ? html`<div class="flash flash--error">${state.deleteError}</div>` : null}
            <p class="confirm-text">Are you sure you want to delete this intervention? Task due dates will be recomputed from the remaining history. The equipment's hour-meter reading is not lowered.</p>
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
