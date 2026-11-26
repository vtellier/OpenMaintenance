import { component, html, reactive } from '@arrow-js/core'
import { EquipmentApi, TaskApi, InterventionApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { formatHours } from '@/lib/format'
import { dueTimingText } from '@/lib/dueTiming'
import { byUrgency } from '@/lib/urgency'
import { relativeTime, isHoursStale, isHoursVeryStale } from '@/lib/timestamp'
import { EquipmentRow, InterventionRow, TaskRow, toEquipmentRow, toInterventionRow, toTaskRow } from '@/lib/rows'
import { equipmentAvatar } from '@/components/EquipmentAvatar'
import { freshnessBannerEquipments, sameHoursReading } from '@/lib/hourMeterFreshness'
import { FullInterventionModal } from '@/components/FullInterventionModal'

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)
const interventionApi = new InterventionApi(apiConfig)

export function DashboardPage() {
  return component(() => {
    const state = reactive({
      equipments: [] as EquipmentRow[],
      tasks: [] as TaskRow[],
      interventions: [] as InterventionRow[],
      loaded: false,
      loadError: null as string | null,
      doneFormOpen: false,
      sameHoursSavingId: null as number | null,
    })

    async function load() {
      try {
        const [eqs, ts, invs] = await Promise.all([
          equipmentApi.listEquipments(),
          taskApi.listTasks(),
          interventionApi.listInterventions(),
        ])

        state.equipments = eqs.map(toEquipmentRow)
        state.tasks = ts.map(toTaskRow)
        state.interventions = invs.map(toInterventionRow)
      } catch {
        state.loadError = 'Failed to load data'
      } finally {
        state.loaded = true
      }
    }

    load()

    async function onSameHours(eq: EquipmentRow) {
      const hours = sameHoursReading(eq)
      if (eq.id == null || hours == null || state.sameHoursSavingId != null) return
      state.sameHoursSavingId = eq.id
      try {
        await equipmentApi.updateEquipmentHours({
          id: eq.id,
          equipmentHoursInput: { hours },
        })
        await load()
      } catch {
        state.loadError = 'Failed to update hours'
      } finally {
        state.sameHoursSavingId = null
      }
    }

    // Done opens the full intervention form, prefilled for the task. Built
    // when opened, outside any reactive expression: the form prefills from the
    // page's data once, and a later change to that data does not rebuild it
    // and lose what the user typed.
    let doneForm: ReturnType<typeof FullInterventionModal> | null = null

    function onDone(task: TaskRow) {
      if (task.id == null) return
      doneForm = FullInterventionModal({ done: { taskId: task.id } }, {
        equipments: () => state.equipments,
        allTasks: () => state.tasks,
        interventions: () => state.interventions,
        onClose: onCloseDoneForm,
        // A new log never leaves the reading in doubt: nothing to ask.
        onSaved: onDoneFormSaved,
      })
      state.doneFormOpen = true
    }

    function onCloseDoneForm() {
      state.doneFormOpen = false
    }

    async function onDoneFormSaved() {
      state.doneFormOpen = false
      await load()
    }

    // No reading yet: nothing to confirm, so only Update is offered. The rows
    // call it from a function slot, () => sameHoursButton(eq): a slot that
    // switches between null and a template must be one (arrow-js gotchas 8, 9).
    function sameHoursButton(eq: EquipmentRow) {
      if (sameHoursReading(eq) == null) return null
      return html`<button class="btn btn--small btn--ghost" @click="${() => onSameHours(eq)}" disabled="${() => state.sameHoursSavingId === eq.id}">${() => state.sameHoursSavingId === eq.id ? '...' : 'Same hours'}</button>`
    }

    return html`<section class="page">
      <h1>Dashboard</h1>

      ${() => {
        if (!state.loaded) return html`<p class="page__empty">Loading...</p>`
        if (state.loadError) return html`<div class="flash flash--error">${state.loadError}</div>`

        // Hour-tracked equipments in service, oldest update first.
        const hourEquipments = freshnessBannerEquipments(state.equipments)

        const staleHourEqs = hourEquipments.filter(eq => isHoursStale(eq.hoursUpdatedAt))
        const freshHourEqs = hourEquipments.filter(eq => !isHoursStale(eq.hoursUpdatedAt))

        const dueTasks = state.tasks.filter(
          t => t.dueStatus === 'overdue' || t.dueStatus === 'due_soon'
        )

        const grouped = new Map<number, TaskRow[]>()
        for (const task of dueTasks) {
          const eqId = task.equipmentId
          if (eqId == null) continue
          if (!grouped.has(eqId)) grouped.set(eqId, [])
          grouped.get(eqId)!.push(task)
        }

        for (const [, tasks] of grouped) tasks.sort(byUrgency)

        // Blocks in the order of their most urgent task.
        const entries = [...grouped.entries()]
        entries.sort(([, tasksA], [, tasksB]) => byUrgency(tasksA[0], tasksB[0]))

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
                  ${() => sameHoursButton(eq)}
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
                    ${() => sameHoursButton(eq)}
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

            // Every dynamic child is a function: when the slot runs again, the
            // same-shaped templates are updated in place, and static arrays or
            // templates keep their first render (Arrow.js Gotcha 9, #109).
            return html`<div class="dashboard-tasks">
              ${() => entries.map(([eqId, tasks]) => {
                const eq = state.equipments.find(e => e.id === eqId)
                if (!eq) {
                  console.warn(`DashboardPage: tasks reference unknown equipment ${eqId}`)
                  return html``
                }
                const eqDetailHref = '/equipments/' + eqId
                return html`<div class="equipment-block">
                  <div class="equipment-block__header">
                    <a href="${() => eqDetailHref}" class="equipment-block__name">${() => equipmentAvatar(eq)}<span>${eq.name}</span></a>
                    ${() => eq.tracksHours ? html`<span class="equipment-block__hours">${formatHours(eq.hours)}</span>` : null}
                  </div>
                  <div class="task-list-compact">
                    ${() => tasks.map(t => {
                      const dueClass = 'due-indicator due-indicator--' + (t.dueStatus === 'overdue' ? 'overdue' : 'due-soon')
                      const dueLabel = t.dueStatus === 'overdue' ? 'Overdue' : 'Due soon'
                      const dueRelativeStr = dueTimingText(t)
                      return html`<div class="task-row">
                        <div class="task-row__info">
                          <p class="task-row__name">${t.name}</p>
                          <p class="task-row__meta"><span class="${dueClass}">${dueLabel} \u2014 ${dueRelativeStr}</span></p>
                        </div>
                        <div class="task-row__actions">
                          <button class="btn btn--small" @click="${() => onDone(t)}">Done</button>
                        </div>
                      </div>`
                    })}
                  </div>
                </div>`
              })}
            </div>`
          }}
        `
      }}

      ${() => state.doneFormOpen ? doneForm : null}
    </section>`
  })()
}
