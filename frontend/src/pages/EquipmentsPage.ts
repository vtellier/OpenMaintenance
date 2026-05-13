import { html } from '@arrow-js/core'

export const EquipmentsPage = () =>
  html`<section class="page">
    <div class="page__header">
      <h1>Equipments</h1>
      <button class="btn btn--accent">+ Add equipment</button>
    </div>
    <p class="page__empty">No equipments yet. Add your first equipment.</p>
  </section>`
