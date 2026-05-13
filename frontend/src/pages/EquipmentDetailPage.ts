import { html } from '@arrow-js/core'
import { Equipment } from '@generated/api/models/Equipment'
import { Task } from '@generated/api/models/Task'
import { Intervention } from '@generated/api/models/Intervention'
import { EquipmentApi, TaskApi, InterventionApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { relativeTime, formatHours, formatDate, isHoursVeryStale } from '@/lib/format'

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)
const interventionApi = new InterventionApi(apiConfig)

export async function EquipmentDetailPage(id: string, currentTab: string) {
  const equipmentId = parseInt(id, 10)
  let equipment: Equipment | null = null
  let tasks: Task[] = []
  let interventions: Intervention[] = []
  let allTasks: Task[] = []
  let error: string | null = null

  try {
    const [eq, ts, interventionsResponse, allTs] = await Promise.all([
      equipmentApi.getEquipment({ id: equipmentId }),
      taskApi.listTasksByEquipment({ equipmentId }),
      interventionApi.listInterventions(),
      taskApi.listTasks(),
    ])
    equipment = eq
    tasks = ts
    allTasks = allTs

    const taskIds = new Set(tasks.map((t: Task) => t.id))
    interventions = interventionsResponse.filter(
      (inv: Intervention) => inv.taskId != null && taskIds.has(inv.taskId)
    )
    interventions.sort((a: Intervention, b: Intervention) => {
      if (!a.date || !b.date) return 0
      return b.date.getTime() - a.date.getTime()
    })
  } catch (err) {
    error = 'Failed to load equipment'
  }

  function getTaskName(taskId: number | undefined): string {
    const t = allTasks.find((tt: Task) => tt.id === taskId)
    return t?.name || ''
  }

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

  if (error) {
    return html`<section class="page">
      <a href="/equipments" class="back-link">&larr; Back to equipments</a>
      <div class="flash flash--error">${error}</div>
    </section>`
  }

  if (!equipment) {
    return html`<section class="page">
      <a href="/equipments" class="back-link">&larr; Back to equipments</a>
      <p class="page__empty">Equipment not found.</p>
    </section>`
  }

  const hoursClass = isHoursVeryStale(equipment.hoursUpdatedAt) ? 'very-stale' : ''
  const editHref = '/equipments/' + equipmentId + '/edit'
  const deleteHref = '/equipments/' + equipmentId + '/delete'
  const updateHoursHref = '/equipments/' + equipmentId + '/edit/hours'

  return html`<section class="page">
    <a href="/equipments" class="back-link">&larr; Back to equipments</a>

    <div class="detail-header">
      <div class="detail-header__top">
        <div class="detail-header__title">
          <h1>${equipment.name}</h1>
        </div>
        <div class="detail-header__actions">
          ${equipment.tracksHours ? html`<a href="${updateHoursHref}" class="btn">Update hours</a>` : null}
          <a href="${editHref}" class="btn">Edit</a>
          <a href="${deleteHref}" class="btn">Delete</a>
        </div>
      </div>
      ${equipment.tracksHours ? html`<div class="detail-header__hours">
        <span>${formatHours(equipment.hours)}</span>
        <span class="${hoursClass}">\u2022 updated ${relativeTime(equipment.hoursUpdatedAt)}</span>
      </div>` : null}
    </div>

    <nav class="sub-tabs">${tabLinks}</nav>

    <div class="tab-content">
      ${currentTab === '' ? html`
        ${tasks.length === 0
          ? html`<p class="page__empty">No tasks defined for this equipment.</p>`
          : html`<div class="task-list-compact">
            ${tasks.map(t => {
              const dueLabel = t.dueStatus === 'overdue' ? 'Overdue' : t.dueStatus === 'due_soon' ? 'Due soon' : 'OK'
              const parts: string[] = []
              if (t.hoursInterval) parts.push(t.hoursInterval + 'h')
              if (t.monthsInterval) parts.push(t.monthsInterval + 'mo')
              const dueClass = 'due-indicator due-indicator--' + (t.dueStatus === 'overdue' ? 'overdue' : t.dueStatus === 'due_soon' ? 'due-soon' : 'ok')
              return html`<div class="task-row">
                <div class="task-row__info">
                  <p class="task-row__name">${t.name}</p>
                  <p class="task-row__interval">Every ${parts.join(', ')}</p>
                </div>
                <div class="task-row__due">
                  <span class="${dueClass}">${dueLabel}</span>
                </div>
              </div>`
            })}
          </div>`
        }
      ` : null}

      ${currentTab === 'history' ? html`
        ${interventions.length === 0
          ? html`<p class="page__empty">No interventions recorded yet.</p>`
          : html`<div class="history-list">
            ${interventions.map(inv => {
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
      ` : null}

      ${currentTab === 'info' ? html`
        <div class="info-tab">
          <div class="form-field">
            <label class="form-field__label">Name</label>
            <p>${equipment.name}</p>
          </div>
          <div class="form-field">
            <label class="form-field__label">Description</label>
            <p>${equipment.description || 'None'}</p>
          </div>
          <div class="toggle-row">
            <span class="toggle-row__label">Hour-meter tracking</span>
            <span>${equipment.tracksHours ? 'Enabled' : 'Disabled'}</span>
          </div>
          ${equipment.tracksHours ? html`<div class="form-field">
            <label class="form-field__label">Current hours</label>
            <p>${formatHours(equipment.hours)}</p>
          </div>` : null}
          <div class="form-field">
            <label class="form-field__label">Created</label>
            <p>${formatDate(equipment.createdAt)}</p>
          </div>
        </div>
      ` : null}
    </div>
  </section>`
}
