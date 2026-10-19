import { component, html, reactive } from '@arrow-js/core'
import { EquipmentApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { extractErrorMessage, formatHours } from '@/lib/format'
import { formatTimestampDate } from '@/lib/timestamp'

const equipmentApi = new EquipmentApi(apiConfig)

/** The prefill from `?hours=` (set by the "Reading in doubt" question), or null. */
function prefilledReading(): number | null {
  const raw = new URLSearchParams(window.location.search).get('hours')
  if (raw == null || raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

/**
 * "Correct reading": the deliberate way to fix a wrong reading, the only one
 * that can lower it (doc/gui/equipments.md, "Flow: Correct the reading").
 */
export function EquipmentCorrectHoursPage(idParam: string) {
  const equipmentId = parseInt(idParam, 10)
  const backHref = '/equipments/' + equipmentId
  const initial = prefilledReading()

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
        const eq = await equipmentApi.getEquipment({ id: equipmentId })
        state.name = eq.name ?? ''
        state.currentHours = eq.hours ?? null
        state.lastUpdated = eq.hoursUpdatedAt?.toISOString() ?? null
      } catch {
        state.error = 'Failed to load equipment'
      } finally {
        state.loaded = true
      }
    }

    load()

    const canSave = () => !state.saving && state.newHours != null && state.newHours >= 0

    async function onSubmit() {
      if (!canSave()) return
      state.saving = true
      state.error = null
      try {
        await equipmentApi.correctEquipmentHours({
          id: equipmentId,
          equipmentHoursCorrectionInput: { hours: state.newHours as number },
        })
        window.location.href = backHref
      } catch (err: unknown) {
        state.error = await extractErrorMessage(err, 'Failed to correct the reading')
        state.saving = false
      }
    }

    function onInput(e: Event) {
      const value = (e.target as HTMLInputElement).value
      state.newHours = value === '' ? null : Number(value)
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
