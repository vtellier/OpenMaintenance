import { component, html, reactive } from '@arrow-js/core'
import { EquipmentApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { formatHours, formatDate } from '@/lib/format'

const equipmentApi = new EquipmentApi(apiConfig)

export function EquipmentHoursPage(idParam: string) {
  const equipmentId = parseInt(idParam, 10)
  const backHref = '/equipments/' + equipmentId

  return component(() => {
    const state = reactive({
      name: '',
      tracksHours: false,
      currentHours: 0,
      newHours: 0,
      lastUpdated: null as string | null,
      loaded: false,
      saving: false,
      error: null as string | null,
    })

    async function load() {
      try {
        const eq = await equipmentApi.getEquipment({ id: equipmentId })
        state.name = eq.name ?? ''
        state.tracksHours = eq.tracksHours ?? false
        state.currentHours = eq.hours ?? 0
        state.newHours = eq.hours ?? 0
        state.lastUpdated = eq.hoursUpdatedAt?.toISOString() ?? null
      } catch {
        state.error = 'Failed to load equipment'
      } finally {
        state.loaded = true
      }
    }

    load()

    async function onSubmit() {
      if (state.newHours < state.currentHours) return
      state.saving = true
      state.error = null
      try {
        await equipmentApi.updateEquipment({
          id: equipmentId,
          equipmentInput: {
            name: state.name,
            tracksHours: state.tracksHours,
            hours: state.newHours,
          },
        })
        window.location.href = backHref
      } catch {
        state.error = 'Failed to update hours'
        state.saving = false
      }
    }

    return html`<section class="page">
      <a href="${backHref}" class="back-link">&larr; Back</a>

      ${() => {
        if (!state.loaded) return html`<p class="page__empty">Loading...</p>`
        if (state.error && !state.name) return html`<div class="flash flash--error">${state.error}</div>`

        return html`
          <h1>Update hours</h1>

          ${state.error ? html`<div class="flash flash--error">${state.error}</div>` : null}

          <div class="form-page">
            <p class="confirm-text">Updating hours for <strong>${() => state.name}</strong></p>

            <div class="form-field">
              <label class="form-field__label">Current hours</label>
              <p>${() => formatHours(state.currentHours)}</p>
            </div>

            ${() => state.lastUpdated ? html`
              <div class="form-field">
                <label class="form-field__label">Last updated</label>
                <p>${formatDate(state.lastUpdated)}</p>
              </div>
            ` : null}

            <div class="form-field">
              <label class="form-field__label">New hours</label>
              <input type="number" min="${() => String(state.currentHours)}" .value="${() => String(state.newHours)}" @input="${(e: Event) => { state.newHours = Number((e.target as HTMLInputElement).value) }}" />
            </div>

            <div class="form__actions">
              <a href="${backHref}" class="btn">Cancel</a>
              <button class="btn btn--accent" @click="${onSubmit}" disabled="${() => state.saving || state.newHours < state.currentHours}">
                ${() => state.saving ? 'Saving...' : 'Update hours'}
              </button>
            </div>
          </div>
        `
      }}
    </section>`
  })()
}
