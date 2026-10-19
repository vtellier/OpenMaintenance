import { html, reactive } from '@arrow-js/core'
import { Equipment } from '@generated/api/models/Equipment'
import { Task } from '@generated/api/models/Task'
import { InterventionApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { InterventionPhotos } from '@/components/InterventionPhotos'
import {
  InterventionFormContext,
  InterventionFormSource,
  canSave,
  isExpiryTask,
  prefill,
  save,
  selectEquipment,
} from '@/lib/interventionForm'

const interventionApi = new InterventionApi(apiConfig)

/**
 * The full intervention form (log and edit). It prefills itself from what it
 * opens for, and validates and saves through @/lib/interventionForm. The page
 * only closes it, and reloads its data once it has saved.
 */
export function FullInterventionModal(
  source: InterventionFormSource,
  opts: {
    equipments: () => Pick<Equipment, 'id' | 'name' | 'tracksHours' | 'hours'>[]
    allTasks: () => Pick<Task, 'id' | 'name' | 'equipmentId' | 'kind'>[]
    /** Hides the equipment picker: the form is opened from that equipment's page. */
    equipmentIdFixed?: number
    onClose: () => void
    onSaved: () => void | Promise<void>
  },
) {
  const equipments = opts.equipments
  const allTasks = opts.allTasks
  const equipmentIdFixed = opts.equipmentIdFixed
  const ctx = (): InterventionFormContext => ({ equipments: equipments(), tasks: allTasks() })

  const state = reactive({
    ...prefill(source, ctx()),
    saving: false,
    error: null as string | null,
  })

  // Photos can only be attached to an already-saved intervention (we need its
  // id). When editing one, mount the photo manager; when logging a new one,
  // show a hint instead.
  const photos = state.editId != null ? InterventionPhotos(state.editId) : null

  const filteredTasks = () => {
    const eqId = state.equipmentId
    if (eqId == null) return []
    return allTasks().filter(t => t.equipmentId === eqId)
  }

  const selectedEq = () => {
    const eqId = state.equipmentId
    if (eqId == null) return null
    return equipments().find(e => e.id === eqId) ?? null
  }

  const tracksHours = () => selectedEq()?.tracksHours ?? false

  function onEquipmentChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value
    selectEquipment(state, val ? parseInt(val, 10) : null, ctx())
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

  function onExpiryDateChange(e: Event) {
    state.expiryDate = (e.target as HTMLInputElement).value
  }

  function onHoursChange(e: Event) {
    const value = (e.target as HTMLInputElement).value
    state.hours = value === '' ? null : Number(value)
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

  const modalTitle = state.editId != null ? 'Edit intervention' : 'Log intervention'

  const isSaveDisabled = () => state.saving || !canSave(state, ctx())

  async function onSave() {
    if (!canSave(state, ctx())) return
    state.saving = true
    state.error = null
    const error = await save(state, ctx(), interventionApi)
    state.saving = false
    if (error) state.error = error
    else await opts.onSaved()
  }

  function onOverlayClick(e: Event) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) opts.onClose()
  }

  return html`
    <div class="modal-overlay" @click="${onOverlayClick}">
      <div class="modal">
        <h2 class="modal__title">${modalTitle}</h2>
        ${() => state.error ? html`<div class="flash flash--error">${state.error}</div>` : null}

        ${equipmentIdFixed == null ? html`
          <div class="form-field">
            <label class="form-field__label">Equipment *</label>
            <select .value="${() => state.equipmentId != null ? String(state.equipmentId) : ''}" @change="${onEquipmentChange}">
              <option value="">-- Select equipment --</option>
              ${() => equipments().map(eq => state.equipmentId === eq.id
                ? html`<option value="${String(eq.id)}" selected="selected">${eq.name}</option>`
                : html`<option value="${String(eq.id)}">${eq.name}</option>`)}
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
            ${() => filteredTasks().map(t => state.taskId === t.id
              ? html`<option value="${String(t.id)}" selected="selected">${t.name}</option>`
              : html`<option value="${String(t.id)}">${t.name}</option>`)}
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
            <input type="number" min="0" .value="${() => state.hours == null ? '' : String(state.hours)}" @input="${onHoursChange}" />
          </div>
        ` : null}

        ${() => isExpiryTask(state, ctx()) ? html`
          <div class="form-field">
            <label class="form-field__label">Expiry date *</label>
            <input type="date" aria-label="Expiry date" .value="${() => state.expiryDate}" @input="${onExpiryDateChange}" />
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
          <button class="btn" @click="${opts.onClose}">Cancel</button>
          <button class="btn btn--accent" @click="${onSave}" disabled="${isSaveDisabled}">
            ${() => state.saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  `
}
