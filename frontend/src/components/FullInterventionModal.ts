import { html, type ArrowExpression } from '@arrow-js/core'
import { Equipment } from '@generated/api/models/Equipment'
import { Task } from '@generated/api/models/Task'
import { formatHours } from '@/lib/format'

export interface InterventionFormState {
  equipmentId: number | null
  taskId: number | null
  date: string
  hours: number
  location: string
  performedBy: string
  comments: string
  saving: boolean
  error: string | null
}

export function FullInterventionModal(
  state: InterventionFormState,
  opts: {
    equipments: () => Equipment[]
    allTasks: () => Task[]
    equipmentIdFixed?: number
    title?: string
    onCancel: () => void
    onOverlayClick: (e: Event) => void
    onSave: () => void
  },
) {
  const equipments = opts.equipments
  const allTasks = opts.allTasks
  const equipmentIdFixed = opts.equipmentIdFixed

  const filteredTasks = () => {
    const eqId = state.equipmentId ?? equipmentIdFixed
    if (eqId == null) return [] as Task[]
    return allTasks().filter(t => t.equipmentId === eqId)
  }

  const selectedEq = () => {
    const eqId = state.equipmentId ?? equipmentIdFixed
    if (eqId == null) return null
    return equipments().find(e => e.id === eqId) ?? null
  }

  const tracksHours = () => selectedEq()?.tracksHours ?? false

  function onEquipmentChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value
    state.equipmentId = val ? parseInt(val, 10) : null
    state.taskId = null
    if (!tracksHours()) state.hours = 0
  }

  function onTaskChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value
    state.taskId = val ? parseInt(val, 10) : null
  }

  function onDateChange(e: Event) {
    state.date = (e.target as HTMLInputElement).value
  }

  function onHoursChange(e: Event) {
    state.hours = Number((e.target as HTMLInputElement).value)
  }

  function onLocationChange(e: Event) {
    state.location = (e.target as HTMLInputElement).value
  }

  function onPerformedByChange(e: Event) {
    state.performedBy = (e.target as HTMLInputElement).value
  }

  function onCommentsChange(e: Event) {
    state.comments = (e.target as HTMLTextAreaElement).value
  }

  const modalTitle = opts.title ?? 'Log intervention'

  return html`
    <div class="modal-overlay" @click="${opts.onOverlayClick}">
      <div class="modal">
        <h2 class="modal__title">${modalTitle}</h2>
        ${() => state.error ? html`<div class="flash flash--error">${state.error}</div>` : null}

        ${equipmentIdFixed == null ? html`
          <div class="form-field">
            <label class="form-field__label">Equipment *</label>
            <select .value="${() => state.equipmentId != null ? String(state.equipmentId) : ''}" @change="${onEquipmentChange}">
              <option value="">-- Select equipment --</option>
              ${() => equipments().map(eq => html`<option value="${String(eq.id)}">${eq.name}</option>`)}
            </select>
          </div>
        ` : null}

        <div class="form-field">
          <label class="form-field__label">Task *</label>
          <select .value="${() => state.taskId != null ? String(state.taskId) : ''}" @change="${onTaskChange}">
            <option value="">-- Select task --</option>
            ${() => filteredTasks().map(t => html`<option value="${String(t.id)}">${t.name}</option>`)}
          </select>
        </div>

        <div class="form-field">
          <label class="form-field__label">Date *</label>
          <input type="date" .value="${() => state.date}" @input="${onDateChange}" />
        </div>

        ${() => tracksHours() ? html`
          <div class="form-field">
            <label class="form-field__label">Hours</label>
            <input type="number" min="0" .value="${() => String(state.hours)}" @input="${onHoursChange}" />
          </div>
        ` : null}

        <div class="form-field">
          <label class="form-field__label">Location</label>
          <input placeholder="e.g. Marina X, Home garage" .value="${() => state.location}" @input="${onLocationChange}" />
        </div>

        <div class="form-field">
          <label class="form-field__label">Done by</label>
          <input placeholder="e.g. Self, Garage du Port" .value="${() => state.performedBy}" @input="${onPerformedByChange}" />
        </div>

        <div class="form-field">
          <label class="form-field__label">Comments</label>
          <textarea placeholder="Optional notes" .value="${() => state.comments}" @input="${onCommentsChange}"></textarea>
        </div>

        <div class="modal__actions">
          <button class="btn" @click="${opts.onCancel}">Cancel</button>
          <button class="btn btn--accent" @click="${opts.onSave}" disabled="${() => state.saving || !state.taskId || !state.date}">
            ${() => state.saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  `
}
