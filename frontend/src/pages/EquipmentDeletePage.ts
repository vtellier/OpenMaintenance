import { component, html, reactive } from '@arrow-js/core'
import { EquipmentApi } from '@generated/api'
import { apiConfig } from '@/api/config'

const equipmentApi = new EquipmentApi(apiConfig)

export function EquipmentDeletePage(idParam: string) {
  const equipmentId = parseInt(idParam, 10)
  const backHref = '/equipments/' + equipmentId

  return component(() => {
    const state = reactive({
      name: '',
      loaded: false,
      loadError: false,
      deleting: false,
      error: null as string | null,
    })

    async function load() {
      try {
        const eq = await equipmentApi.getEquipment({ id: equipmentId })
        state.name = eq.name ?? ''
        state.loaded = true
      } catch {
        state.loadError = true
        state.loaded = true
      }
    }

    load()

    async function onConfirm() {
      state.deleting = true
      state.error = null
      try {
        await equipmentApi.deleteEquipment({ id: equipmentId })
        window.location.href = '/equipments'
      } catch {
        state.error = 'Failed to delete equipment'
        state.deleting = false
      }
    }

    return html`<section class="page">
      <a href="${backHref}" class="back-link">&larr; Back</a>

      ${() => {
        if (!state.loaded) return html`<p class="page__empty">Loading...</p>`
        if (state.loadError) return html`<p class="page__empty">Failed to load equipment.</p>`

        return html`
          <h1>Delete equipment</h1>

          ${state.error ? html`<div class="flash flash--error">${state.error}</div>` : null}

          <p class="confirm-text">Are you sure you want to delete <strong>${() => state.name}</strong>? This will also delete all associated tasks and interventions. This action cannot be undone.</p>

          <div class="form__actions">
            <a href="${backHref}" class="btn">Cancel</a>
            <button class="btn btn--danger" @click="${onConfirm}" disabled="${() => state.deleting}">
              ${() => state.deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        `
      }}
    </section>`
  })()
}
