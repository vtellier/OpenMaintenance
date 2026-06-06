import { html, type ArrowExpression } from '@arrow-js/core'
import { Equipment } from '@generated/api/models/Equipment'
import { Task } from '@generated/api/models/Task'
import { formatHours } from '@/lib/format'
import { InterventionPhotos } from '@/components/InterventionPhotos'

export interface InterventionFormState {
  equipmentId: number | null
  taskId: number | null
  isExceptional: boolean
  exceptionalLabel: string
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
    interventionId?: number | null
    title?: string
    onCancel: () => void
    onOverlayClick: (e: Event) => void
    onSave: () => void
  },
) {
  const equipments = opts.equipments
  const allTasks = opts.allTasks
  const equipmentIdFixed = opts.equipmentIdFixed

  // Photos can only be attached to an already-saved intervention (we need its
  // id). When editing one, mount the photo manager; when logging a new one,
  // show a hint instead.
  const photos = opts.interventionId != null ? InterventionPhotos(opts.interventionId) : null

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

  function onExceptionalChange(e: Event) {
    state.isExceptional = (e.target as HTMLInputElement).checked
    if (state.isExceptional) {
      state.taskId = null
    } else {
      state.exceptionalLabel = ''
    }
  }

  function onExceptionalLabelChange(e: Event) {
    state.exceptionalLabel = (e.target as HTMLInputElement).value
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

  const isSaveDisabled = () => {
    if (state.saving || !state.date) return true
    if (state.isExceptional) {
      const hasEquipment = state.equipmentId != null || equipmentIdFixed != null
      return !hasEquipment || !state.exceptionalLabel.trim()
    }
    return !state.taskId
  }

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

        <div class="form-field form-field--inline">
          <label class="form-field__checkbox-label">
            <input type="checkbox" .checked="${() => state.isExceptional}" @change="${onExceptionalChange}" />
            Exceptional intervention
          </label>
          <span class="info-icon" data-tooltip="Exceptional interventions are one-off operations not part of your maintenance plan (e.g. replacing a broken part). They appear in the history but do not affect task due dates.">ⓘ</span>
        </div>

        <div class="form-field">
          <label class="form-field__label">Task *</label>
          <select .value="${() => state.taskId != null ? String(state.taskId) : ''}" @change="${onTaskChange}" disabled="${() => state.isExceptional}">
            <option value="">-- Select task --</option>
            ${() => filteredTasks().map(t => html`<option value="${String(t.id)}">${t.name}</option>`)}
          </select>
        </div>

        ${() => state.isExceptional ? html`
          <div class="form-field">
            <label class="form-field__label">Exceptional intervention *</label>
            <input placeholder="e.g. Replaced broken impeller" .value="${() => state.exceptionalLabel}" @input="${onExceptionalLabelChange}" />
          </div>
        ` : null}

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

        ${photos
          ? photos.render()
          : html`<p class="photo-hint">Save the intervention to attach photos.</p>`}

        <div class="modal__actions">
          <button class="btn" @click="${opts.onCancel}">Cancel</button>
          <button class="btn btn--accent" @click="${opts.onSave}" disabled="${isSaveDisabled}">
            ${() => state.saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  `
}
