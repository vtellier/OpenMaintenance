import { component, html, reactive } from '@arrow-js/core'
import { Intervention } from '../../generated/api/models/Intervention'

export const InterventionCard = component(() => {
  const state = reactive({
    interventions: [] as Intervention[],
    draft: {
      title: '',
      description: '',
      date: '',
    },
  })

  function add() {
    const { title, description, date } = state.draft
    if (!title.trim()) return

    state.interventions.push({
      id: state.interventions.length + 1,
      title: title.trim(),
      description: description.trim(),
      date: date.trim(),
    })

    state.draft = { title: '', description: '', date: '' }
  }

  function remove(id: number) {
    const i = state.interventions.findIndex((i) => i.id === id)
    if (i !== -1) state.interventions.splice(i, 1)
  }

  return html`<div class="card">
    <p class="section__label">Interventions</p>
    <div class="intervention-input">
      <input
        placeholder="Intervention title"
        .value="${() => state.draft.title}"
        @input="${(e: Event) => {
          state.draft.title = (e.target as HTMLInputElement).value
        }}"
      />
      <input
        placeholder="Intervention description"
        .value="${() => state.draft.description}"
        @input="${(e: Event) => {
          state.draft.description = (e.target as HTMLInputElement).value
        }}"
      />
      <input
        type="date"
        placeholder="Intervention date"
        .value="${() => state.draft.date}"
        @input="${(e: Event) => {
          state.draft.date = (e.target as HTMLInputElement).value
        }}"
      />
      <button class="btn btn--accent" @click="${add}">Add</button>
    </div>
    ${() =>
      state.interventions.length
        ? html`<ul class="intervention-list">
            ${() =>
              state.interventions.map(
                (intervention) =>
                  html`<li class="intervention-item">
                    <div>
                      <strong>${intervention.title}</strong>
                      <p>${intervention.description}</p>
                      <small>Date: ${intervention.date}</small>
                    </div>
                    <button @click="${() => remove(intervention.id)}">&times;</button>
                  </li>`.key(intervention.id)
              )}
          </ul>`
        : html`<p class="intervention-empty">No interventions yet. Add one above.</p>`}
  </div>`
})