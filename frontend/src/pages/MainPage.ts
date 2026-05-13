import { component, html, reactive } from '@arrow-js/core'
import { EquipmentCard } from '@/components/EquipmentCard'
import { TaskCard } from '@/components/TaskCard'
import { InterventionCard } from '@/components/InterventionCard'

export const MainPage = component(() => {
  const state = reactive({
    activeTab: 'equipment',
  })

  return html`<div class="main-page">
    <div class="tabs">
      <button class="${() => 'tab-button' + (state.activeTab === 'equipment' ? ' active' : '')}" @click="${() => state.activeTab = 'equipment'}">Equipment</button>
      <button class="${() => 'tab-button' + (state.activeTab === 'task' ? ' active' : '')}" @click="${() => state.activeTab = 'task'}">Tasks</button>
      <button class="${() => 'tab-button' + (state.activeTab === 'intervention' ? ' active' : '')}" @click="${() => state.activeTab = 'intervention'}">Interventions</button>
    </div>
    <div class="tab-content">
      ${() => state.activeTab === 'equipment' ? html`${EquipmentCard()}` : null}
      ${() => state.activeTab === 'task' ? html`${TaskCard()}` : null}
      ${() => state.activeTab === 'intervention' ? html`${InterventionCard()}` : null}
    </div>
  </div>`
})