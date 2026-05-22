import { component, html, reactive } from '@arrow-js/core'
import { EquipmentApi, TaskApi } from '@generated/api'
import { apiConfig } from '@/api/config'

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)

export function EquipmentEditPage(idParam: string) {
  const equipmentId = parseInt(idParam, 10)
  const backHref = '/equipments/' + equipmentId

  return component(() => {
    const state = reactive({
      name: '',
      description: '',
      commissionedAt: '',
      tracksHours: false,
      hours: 0,
      loaded: false,
      saving: false,
      error: null as string | null,
      showConfirmTracks: false,
    })

    async function load() {
      try {
        const eq = await equipmentApi.getEquipment({ id: equipmentId })
        state.name = eq.name ?? ''
        state.description = eq.description ?? ''
        state.commissionedAt = eq.commissionedAt ? (eq.commissionedAt as any).toISOString().substring(0, 10) : ''
        state.tracksHours = eq.tracksHours ?? false
        state.hours = eq.hours ?? 0
      } catch {
        state.error = 'Failed to load equipment'
      } finally {
        state.loaded = true
      }
    }

    load()

    async function onSubmit(skipConfirmCheck = false) {
      if (!state.name.trim()) return
      state.saving = true
      state.error = null

      if (state.tracksHours && !skipConfirmCheck) {
        try {
          const tasks = await taskApi.listTasksByEquipment({ equipmentId })
          const hasHoursInterval = tasks.some(t => t.hoursInterval != null && t.hoursInterval > 0)
          if (hasHoursInterval) {
            state.showConfirmTracks = true
            state.saving = false
            return
          }
        } catch {
          // proceed without confirmation on error
        }
      }

      try {
        await equipmentApi.updateEquipment({
          id: equipmentId,
          equipmentInput: {
            name: state.name.trim(),
            description: state.description.trim() || undefined,
            commissionedAt: state.commissionedAt ? new Date(state.commissionedAt + 'T12:00:00') : undefined,
            tracksHours: state.tracksHours,
            hours: state.tracksHours ? state.hours : undefined,
          },
        })
        window.location.href = backHref
      } catch {
        state.error = 'Failed to save equipment'
        state.saving = false
      }
    }

    return html`<section class="page">
      <a href="${backHref}" class="back-link">&larr; Back</a>

      ${() => {
        if (!state.loaded) return html`<p class="page__empty">Loading...</p>`
        if (state.error && !state.name) return html`<div class="flash flash--error">${state.error}</div>`

        return html`
          <h1>Edit equipment</h1>

          ${state.error ? html`<div class="flash flash--error">${state.error}</div>` : null}

          <div class="form-page">
            <div class="form-field">
              <label class="form-field__label">Name *</label>
              <input placeholder="e.g. Main Engine" .value="${() => state.name}" @input="${(e: Event) => { state.name = (e.target as HTMLInputElement).value }}" />
            </div>
            <div class="form-field">
              <label class="form-field__label">Description</label>
              <textarea placeholder="Optional description" .value="${() => state.description}" @input="${(e: Event) => { state.description = (e.target as HTMLTextAreaElement).value }}"></textarea>
            </div>
            <div class="form-field">
              <label class="form-field__label">Date of commissioning</label>
              <input type="date" .value="${() => state.commissionedAt}" @input="${(e: Event) => { state.commissionedAt = (e.target as HTMLInputElement).value }}" />
            </div>
            <div class="toggle-row">
              <span class="toggle-row__label">This equipment has an hour-meter</span>
              <label class="toggle-switch">
                <input type="checkbox" .checked="${() => state.tracksHours}" @change="${() => { state.tracksHours = !state.tracksHours }}" />
                <span class="toggle-slider"></span>
              </label>
            </div>
            ${() => state.tracksHours ? html`
              <div class="form-field">
                <label class="form-field__label">Current hours</label>
                <input type="number" min="0" .value="${() => String(state.hours)}" @input="${(e: Event) => { state.hours = Number((e.target as HTMLInputElement).value) }}" />
              </div>
            ` : null}
            <div class="form__actions">
              <a href="${backHref}" class="btn">Cancel</a>
              <button class="btn btn--accent" @click="${() => onSubmit()}" disabled="${() => state.saving || !state.name.trim()}">
                ${() => state.saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          ${() => state.showConfirmTracks ? html`
            <div class="modal-overlay" @click="${() => { state.showConfirmTracks = false }}">
              <div class="modal">
                <h2 class="modal__title">Enable hour-meter tracking?</h2>
                <p class="confirm-text">This equipment has tasks with hour-based intervals. Enabling hour-meter tracking will link those intervals to the equipment's hour-meter.</p>
                <div class="modal__actions">
                  <button class="btn" @click="${() => { state.showConfirmTracks = false }}">Cancel</button>
                  <button class="btn btn--accent" @click="${() => { state.showConfirmTracks = false; onSubmit(true) }}">Enable</button>
                </div>
              </div>
            </div>
          ` : null}
        `
      }}
    </section>`
  })()
}
