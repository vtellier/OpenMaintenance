import { component, html, reactive } from '@arrow-js/core'
import { EquipmentApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { formatHours } from '@/lib/format'
import { formatTimestampDate } from '@/lib/timestamp'
import { toEquipmentRow } from '@/lib/rows'
import { canUpdateHours, hoursFromInput, hoursUpdateFormOf, saveHoursUpdate } from '@/lib/hoursForm'

const equipmentApi = new EquipmentApi(apiConfig)

export function EquipmentHoursPage(idParam: string) {
  const equipmentId = parseInt(idParam, 10)
  const backHref = '/equipments/' + equipmentId

  return component(() => {
    const state = reactive({
      name: '',
      currentHours: 0,
      newHours: 0,
      lastUpdated: null as string | null,
      loaded: false,
      saving: false,
      error: null as string | null,
    })

    async function load() {
      try {
        const eq = toEquipmentRow(await equipmentApi.getEquipment({ id: equipmentId }))
        const form = hoursUpdateFormOf(eq)
        state.name = eq.name ?? ''
        state.currentHours = form.currentHours
        state.newHours = form.newHours
        state.lastUpdated = eq.hoursUpdatedAt ?? null
      } catch {
        state.error = 'Failed to load equipment'
      } finally {
        state.loaded = true
      }
    }

    load()

    // Read from the state on each call, so a slot that calls it updates.
    const canSave = () => canUpdateHours(state)

    async function onSubmit() {
      if (!canSave()) return
      state.saving = true
      state.error = null
      const error = await saveHoursUpdate(equipmentId, state, equipmentApi)
      if (error == null) {
        window.location.href = backHref
        return
      }
      state.error = error
      state.saving = false
    }

    return html`<section class="page">
      <a href="${backHref}" class="back-link">&larr; Back</a>

      ${() => {
        if (!state.loaded) return html`<p class="page__empty">Loading...</p>`
        if (state.error && !state.name) return html`<div class="flash flash--error">${state.error}</div>`

        return html`
          <h1>Update hours</h1>

          ${() => state.error ? html`<div class="flash flash--error">${state.error}</div>` : null}

          <div class="form-page">
            <p class="confirm-text">Updating hours for <strong>${() => state.name}</strong></p>

            <div class="form-field">
              <label class="form-field__label">Current hours</label>
              <p>${() => formatHours(state.currentHours)}</p>
            </div>

            ${() => state.lastUpdated ? html`
              <div class="form-field">
                <label class="form-field__label">Last updated</label>
                <p>${formatTimestampDate(state.lastUpdated)}</p>
              </div>
            ` : null}

            <div class="form-field">
              <label class="form-field__label">New hours</label>
              <input type="number" aria-label="New hours" min="${() => String(state.currentHours)}" .value="${() => String(state.newHours)}" @input="${(e: Event) => { state.newHours = hoursFromInput((e.target as HTMLInputElement).value) }}" />
            </div>

            <div class="form__actions">
              <a href="${backHref}" class="btn">Cancel</a>
              <button class="btn btn--accent" @click="${onSubmit}" disabled="${() => state.saving || !canSave()}">
                ${() => state.saving ? 'Saving...' : 'Update hours'}
              </button>
            </div>
          </div>
        `
      }}
    </section>`
  })()
}
