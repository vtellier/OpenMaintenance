import { component, html, reactive } from '@arrow-js/core'
import { Equipment } from '../../generated/api/models/Equipment'
import { EquipmentApi, Configuration } from '../../generated/api'

export const EquipmentCard = component(() => {
  // Initialize API client
  const apiConfig = new Configuration({ basePath: 'http://127.0.0.1:3001/api' })
  const equipmentApi = new EquipmentApi(apiConfig)
  
  const state = reactive({
    equipments: [] as Equipment[],
    draft: {
      name: '',
      description: '',
    },
    loading: false,
    error: null as string | null,
  })

  // Load equipments from API
  async function loadEquipments() {
    state.loading = true
    state.error = null
    try {
      const equipments = await equipmentApi.equipmentsGet()
      state.equipments = equipments
    } catch (err) {
      state.error = 'Failed to load equipments'
      console.error('Error loading equipments:', err)
    } finally {
      state.loading = false
    }
  }

  // Initial load
  loadEquipments()

  async function add() {
    const { name, description } = state.draft
    if (!name.trim()) return

    state.loading = true
    state.error = null
    try {
      const newEquipment = {
        name: name.trim(),
        description: description.trim(),
      }
      await equipmentApi.equipmentsPost({ equipment: newEquipment })
      // Refresh the list after successful addition
      await loadEquipments()
    } catch (err) {
      state.error = 'Failed to add equipment'
      console.error('Error adding equipment:', err)
    } finally {
      state.loading = false
    }

    state.draft = { name: '', description: '' }
  }

  async function remove(id: number) {
    state.loading = true
    state.error = null
    try {
      await equipmentApi.equipmentsIdDelete({ id })
      // Refresh the list after successful deletion
      await loadEquipments()
    } catch (err) {
      state.error = 'Failed to remove equipment'
      console.error('Error removing equipment:', err)
    } finally {
      state.loading = false
    }
  }

return html`<div class="card">
  <p class="section__label">Equipments</p>
  ${() => state.loading ? html`<p class="loading">Loading equipments...</p>` : null}
  ${() => state.error ? html`<p class="error">${state.error}</p>` : null}
  <div class="equipment-input">
    <input
      placeholder="Equipment name"
      .value="${() => state.draft.name}"
      @input="${(e: Event) => {
        state.draft.name = (e.target as HTMLInputElement).value
      }}"
    />
    <input
      placeholder="Equipment description"
      .value="${() => state.draft.description}"
      @input="${(e: Event) => {
        state.draft.description = (e.target as HTMLInputElement).value
      }}"
    />
    <button class="btn btn--accent" @click="${add}" disabled="${() => state.loading}">Add</button>
  </div>
  ${() =>
  state.loading
    ? html`<p class="loading">Saving...</p>`
    : state.equipments.length
      ? html`<ul class="equipment-list">
          ${() =>
            state.equipments.map(
              (equipment) =>
                html`<li class="equipment-item">
                  <div>
                    <strong>${equipment.name}</strong>
                    <p>${equipment.description}</p>
                  </div>
                  <button @click="${() => remove(equipment.id)}" disabled="${() => state.loading}">&times;</button>
                </li>`.key(equipment.id)
            )}
        </ul>`
      : html`<p class="equipment-empty">No equipments yet. Add one above.</p>`}
</div>`
})