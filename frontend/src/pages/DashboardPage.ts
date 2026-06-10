import { component, html, reactive } from '@arrow-js/core'
import { Equipment } from '@generated/api/models/Equipment'
import { Task } from '@generated/api/models/Task'
import { Intervention } from '@generated/api/models/Intervention'
import { EquipmentApi, TaskApi, InterventionApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { relativeTime, formatHours, isHoursStale, isHoursVeryStale, dueRelative } from '@/lib/format'
import { equipmentAvatar } from '@/components/EquipmentAvatar'

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)
const interventionApi = new InterventionApi(apiConfig)

export function DashboardPage() {
  return component(() => {
    const state = reactive({
      equipments: [] as Equipment[],
      tasks: [] as Task[],
      interventions: [] as Intervention[],
      loaded: false,
      loadError: null as string | null,
      showQuickLog: false,
      quickTaskId: null as number | null,
      quickTaskName: '',
      quickDate: '',
      quickHours: 0,
      quickPerformedBy: '',
      quickComments: '',
      quickSaving: false,
      quickError: null as string | null,
      sameHoursSavingId: null as number | null,
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
        state.loadError = 'Failed to load data'
      } finally {
        state.loaded = true
      }
    }

    load()

    async function onSameHours(eq: Equipment) {
      if (eq.id == null || state.sameHoursSavingId != null) return
      state.sameHoursSavingId = eq.id
      try {
        await equipmentApi.updateEquipmentHours({
          id: eq.id,
          equipmentHoursInput: { hours: eq.hours ?? 0 },
        })
        await load()
      } catch {
        state.loadError = 'Failed to update hours'
      } finally {
        state.sameHoursSavingId = null
      }
    }

    function getEquipmentForTask(taskId: number | undefined): Equipment | undefined {
      if (taskId == null) return undefined
      const task = state.tasks.find(t => t.id === taskId)
      if (!task || task.equipmentId == null) return undefined
      const eq = state.equipments.find(e => e.id === task.equipmentId)
      return eq
    }

    function onQuickLog(task: Task) {
      state.showQuickLog = true
      state.quickTaskId = task.id ?? null
      state.quickTaskName = task.name ?? ''
      state.quickDate = new Date().toISOString().substring(0, 10)
      const eq = getEquipmentForTask(task.id)
      state.quickHours = eq?.hours ?? 0
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
        const eq = getEquipmentForTask(state.quickTaskId)
        const tracksHours = eq?.tracksHours ?? false
        await interventionApi.createIntervention({
          interventionInput: {
            taskId: state.quickTaskId,
            date: new Date(state.quickDate + 'T00:00:00'),
            hoursAt: tracksHours ? state.quickHours : undefined,
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

    return html`<section class="page">
      <h1>Dashboard</h1>

      ${() => {
        if (!state.loaded) return html`<p class="page__empty">Loading...</p>`
        if (state.loadError) return html`<div class="flash flash--error">${state.loadError}</div>`

        const hourEquipments = state.equipments
          .filter(eq => eq.tracksHours)
          .sort((a, b) => {
            const timeA = a.hoursUpdatedAt ? new Date(a.hoursUpdatedAt).getTime() : 0
            const timeB = b.hoursUpdatedAt ? new Date(b.hoursUpdatedAt).getTime() : 0
            return timeA - timeB
          })

        const staleHourEqs = hourEquipments.filter(eq => isHoursStale(eq.hoursUpdatedAt))
        const freshHourEqs = hourEquipments.filter(eq => !isHoursStale(eq.hoursUpdatedAt))

        const dueTasks = state.tasks.filter(
          t => t.dueStatus === 'overdue' || t.dueStatus === 'due_soon'
        )

        const grouped = new Map<number, Task[]>()
        for (const task of dueTasks) {
          const eqId = task.equipmentId
          if (eqId == null) continue
          if (!grouped.has(eqId)) grouped.set(eqId, [])
          grouped.get(eqId)!.push(task)
        }

        const order = { overdue: 0, due_soon: 1 }
        for (const [, tasks] of grouped) {
          tasks.sort((a, b) => {
            return (order[a.dueStatus as keyof typeof order] ?? 2) - (order[b.dueStatus as keyof typeof order] ?? 2)
          })
        }

        const entries = [...grouped.entries()]
        entries.sort(([, tasksA], [, tasksB]) => {
          const hasOverdueA = tasksA.some(t => t.dueStatus === 'overdue') ? 0 : 1
          const hasOverdueB = tasksB.some(t => t.dueStatus === 'overdue') ? 0 : 1
          return hasOverdueA - hasOverdueB
        })

        const hasDueTasks = entries.length > 0
        const hasEquipments = state.equipments.length > 0

        return html`
          ${() => hourEquipments.length > 0 ? html`<div class="hours-banner">
            <div class="hours-banner__header">
              <span class="hours-banner__title">Keep your hour-meters fresh</span>
            </div>
            <div class="hours-banner__list">
              ${() => staleHourEqs.map(eq => {
                const eqHref = '/equipments/' + eq.id
                const updateHref = '/equipments/' + eq.id + '/edit/hours'
                const stale = isHoursStale(eq.hoursUpdatedAt)
                const rowClass = 'hours-banner__row' + (stale ? ' hours-banner__row--stale' : '')
                const freshnessClass = isHoursVeryStale(eq.hoursUpdatedAt) ? ' very-stale' : stale ? ' stale' : ''
                const updatedClass = 'hours-banner__updated' + freshnessClass
                return html`<div class="${rowClass}">
                  <a href="${eqHref}" class="hours-banner__eq-name">${eq.name}</a>
                  <span class="hours-banner__hours">${formatHours(eq.hours)}</span>
                  <span class="${updatedClass}">updated ${relativeTime(eq.hoursUpdatedAt)}</span>
                  <button class="btn btn--small btn--ghost" @click="${() => onSameHours(eq)}" disabled="${() => state.sameHoursSavingId === eq.id}">${() => state.sameHoursSavingId === eq.id ? '...' : 'Same hours'}</button>
                  <a href="${updateHref}" class="btn btn--small">Update</a>
                </div>`
              })}
              ${() => freshHourEqs.length > 0 ? html`<details class="hours-banner__fresh">
                <summary class="hours-banner__summary">${() => freshHourEqs.length} fresh (show/hide)</summary>
                ${() => freshHourEqs.map(eq => {
                  const eqHref = '/equipments/' + eq.id
                  const updateHref = '/equipments/' + eq.id + '/edit/hours'
                  const rowClass = 'hours-banner__row'
                  const updatedClass = 'hours-banner__updated'
                  return html`<div class="${rowClass}">
                    <a href="${eqHref}" class="hours-banner__eq-name">${eq.name}</a>
                    <span class="hours-banner__hours">${formatHours(eq.hours)}</span>
                    <span class="${updatedClass}">updated ${relativeTime(eq.hoursUpdatedAt)}</span>
                    <button class="btn btn--small btn--ghost" @click="${() => onSameHours(eq)}" disabled="${() => state.sameHoursSavingId === eq.id}">${() => state.sameHoursSavingId === eq.id ? '...' : 'Same hours'}</button>
                    <a href="${updateHref}" class="btn btn--small">Update</a>
                  </div>`
                })}
              </details>` : null}
            </div>
          </div>` : null}

          ${() => {
            if (!hasDueTasks) {
              if (!hasEquipments) {
                return html`<p class="page__empty">
                  You're all caught up. Nothing due right now.<br>
                  <a href="/equipments" class="btn" style="margin-top: 12px; display: inline-flex">Add your first equipment</a>
                </p>`
              }
              return html`<p class="page__empty">You're all caught up. Nothing due right now.</p>`
            }

            return html`<div class="dashboard-tasks">
              ${entries.map(([eqId, tasks]) => {
                const eq = state.equipments.find(e => e.id === eqId)
                if (!eq) { console.warn(`DashboardPage: tasks reference unknown equipment ${eqId}`); return html`` }
                const eqDetailHref = '/equipments/' + eqId
                return html`<div class="equipment-block">
                  <div class="equipment-block__header">
                    <a href="${eqDetailHref}" class="equipment-block__name">${equipmentAvatar(eq)}<span>${eq.name}</span></a>
                    ${eq.tracksHours ? html`<span class="equipment-block__hours">${formatHours(eq.hours)}</span>` : null}
                  </div>
                  <div class="task-list-compact">
                    ${tasks.map(t => {
                      const dueClass = 'due-indicator due-indicator--' + (t.dueStatus === 'overdue' ? 'overdue' : 'due-soon')
                      const dueLabel = t.dueStatus === 'overdue' ? 'Overdue' : 'Due soon'
                      const dueRelativeStr = dueRelative(t.nextDueDate, t.nextDueHours)
                      return html`<div class="task-row">
                        <div class="task-row__info">
                          <p class="task-row__name">${t.name}</p>
                          <p class="task-row__meta"><span class="${dueClass}">${dueLabel} \u2014 ${dueRelativeStr}</span></p>
                        </div>
                        <div class="task-row__actions">
                          <button class="btn btn--small" @click="${() => onQuickLog(t)}">Done</button>
                        </div>
                      </div>`
                    })}
                  </div>
                </div>`
              })}
            </div>`
          }}

          ${() => state.showQuickLog ? html`
            <div class="modal-overlay" @click="${onQuickLogOverlayClick}">
              <div class="modal">
                <h2 class="modal__title">Mark done: ${() => state.quickTaskName}</h2>
                ${() => state.quickError ? html`<div class="flash flash--error">${state.quickError}</div>` : null}
                <div class="form-field">
                  <label class="form-field__label">Date *</label>
                  <input type="date" .value="${() => state.quickDate}" @input="${(e: Event) => { state.quickDate = (e.target as HTMLInputElement).value }}" />
                </div>
                ${() => {
                  const eq = getEquipmentForTask(state.quickTaskId!)
                  const tracksHours = eq?.tracksHours ?? false
                  return tracksHours ? html`
                    <div class="form-field">
                      <label class="form-field__label">Hours</label>
                      <input type="number" min="0" .value="${() => String(state.quickHours)}" @input="${(e: Event) => { state.quickHours = Number((e.target as HTMLInputElement).value) }}" />
                    </div>
                  ` : null
                }}
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
            </div>` : null}
        `
      }}
    </section>`
  })()
}
