import { component, html, reactive } from '@arrow-js/core'
import { EquipmentApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { formatHours } from '@/lib/format'
import { formatTimestampDate } from '@/lib/timestamp'
import { toEquipmentRow } from '@/lib/rows'
import { canCorrect, prefilledReading, readingFromInput, saveCorrection } from '@/lib/hoursForm'

const equipmentApi = new EquipmentApi(apiConfig)

/**
 * "Correct reading": the deliberate way to fix a wrong reading, the only one
 * that can lower it (doc/gui/equipments.md, "Flow: Correct the reading").
 */
export function EquipmentCorrectHoursPage(idParam: string) {
  const equipmentId = parseInt(idParam, 10)
  const backHref = '/equipments/' + equipmentId
  const initial = prefilledReading(window.location.search)

  return component(() => {
    const state = reactive({
      name: '',
      currentHours: null as number | null,
      newHours: initial,
      lastUpdated: null as string | null,
      loaded: false,
      saving: false,
      error: null as string | null,
    })

    async function load() {
      try {
        const eq = toEquipmentRow(await equipmentApi.getEquipment({ id: equipmentId }))
        state.name = eq.name ?? ''
        state.currentHours = eq.hours ?? null
        state.lastUpdated = eq.hoursUpdatedAt ?? null
      } catch {
        state.error = 'Failed to load equipment'
      } finally {
        state.loaded = true
      }
    }

    load()

    const canSave = () => !state.saving && canCorrect(state.newHours)

    async function onSubmit() {
      const hours = state.newHours
      if (state.saving || !canCorrect(hours)) return
      state.saving = true
      state.error = null
      const error = await saveCorrection(hours, equipmentId, equipmentApi)
      if (error == null) {
        window.location.href = backHref
        return
      }
      state.error = error
      state.saving = false
    }

    function onInput(e: Event) {
      state.newHours = readingFromInput((e.target as HTMLInputElement).value)
    }

    return html`<section class="page">
      <a href="${backHref}" class="back-link">&larr; Back</a>

      ${() => {
        if (!state.loaded) return html`<p class="page__empty">Loading...</p>`
        if (state.error && !state.name) return html`<div class="flash flash--error">${state.error}</div>`

        return html`
          <h1>Correct reading</h1>

          ${() => state.error ? html`<div class="flash flash--error">${state.error}</div>` : null}

          <div class="form-page">
            <p class="confirm-text">Correcting the hour-meter reading of <strong>${() => state.name}</strong>.</p>

            <div class="form-field">
              <label class="form-field__label">Current reading</label>
              <p>${() => state.currentHours == null ? 'No reading' : formatHours(state.currentHours)}</p>
            </div>

            ${() => state.lastUpdated ? html`
              <div class="form-field">
                <label class="form-field__label">Last updated</label>
                <p>${formatTimestampDate(state.lastUpdated)}</p>
              </div>
            ` : null}

            <div class="form-field">
              <label class="form-field__label" for="corrected-reading">Corrected reading</label>
              <input id="corrected-reading" type="number" min="0" .value="${() => state.newHours == null ? '' : String(state.newHours)}" @input="${onInput}" />
            </div>

            <p class="confirm-text">The reading becomes this value, even if it is lower than the current one.</p>

            <div class="form__actions">
              <a href="${backHref}" class="btn">Cancel</a>
              <button class="btn btn--accent" @click="${onSubmit}" disabled="${() => !canSave()}">
                ${() => state.saving ? 'Saving...' : 'Correct reading'}
              </button>
            </div>
          </div>
        `
      }}
    </section>`
  })()
}
