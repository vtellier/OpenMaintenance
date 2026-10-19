import { html, reactive } from '@arrow-js/core'
import { Equipment } from '@generated/api/models/Equipment'
import { Task } from '@generated/api/models/Task'
import { InterventionApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { InterventionFormContext, canSave, isExpiryTask, prefill, save } from '@/lib/interventionForm'

const interventionApi = new InterventionApi(apiConfig)

/**
 * The quick log that marks a task done (Dashboard and Equipment detail). It
 * prefills, validates and saves through @/lib/interventionForm, like the full
 * form. The page only closes it, and reloads its data once it has saved.
 */
export function QuickLogModal(
  task: { id: number, name: string },
  opts: {
    equipments: () => Pick<Equipment, 'id' | 'tracksHours' | 'hours'>[]
    tasks: () => Pick<Task, 'id' | 'equipmentId' | 'kind'>[]
    onClose: () => void
    onSaved: () => void | Promise<void>
  },
) {
  const ctx = (): InterventionFormContext => ({ equipments: opts.equipments(), tasks: opts.tasks() })

  const state = reactive({
    ...prefill({ quickLog: { taskId: task.id } }, ctx()),
    saving: false,
    error: null as string | null,
  })

  const tracksHours = () => opts.equipments().find(e => e.id === state.equipmentId)?.tracksHours ?? false

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

  function onPerformedByChange(e: Event) {
    state.performedBy = (e.target as HTMLInputElement).value
  }

  function onCommentsChange(e: Event) {
    state.comments = (e.target as HTMLInputElement).value
  }

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

  const title = 'Mark done: ' + task.name

  return html`
    <div class="modal-overlay" @click="${onOverlayClick}">
      <div class="modal">
        <h2 class="modal__title">${title}</h2>
        ${() => state.error ? html`<div class="flash flash--error">${state.error}</div>` : null}
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
          <label class="form-field__label">Done by</label>
          <input placeholder="e.g. Self, Garage du Port" .value="${() => state.performedBy}" @input="${onPerformedByChange}" />
        </div>
        <div class="form-field">
          <label class="form-field__label">Notes</label>
          <input placeholder="Optional" .value="${() => state.comments}" @input="${onCommentsChange}" />
        </div>
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
