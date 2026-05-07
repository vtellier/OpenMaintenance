import { component, html } from '@arrow-js/core';
import { reactive } from '@arrow-js/core';
import { EquipmentApi, Equipment } from '../../generated/api/apis/EquipmentApi';
import { apiConfig } from '../api/config';

export const ApiTestPage = component(() => {
  const state = reactive({
    equipments: [] as Equipment[],
    loading: false,
    error: null as string | null,
  });

  const fetchEquipments = async () => {
    state.loading = true;
    state.error = null;
    try {
      const api = new EquipmentApi(apiConfig);
      const equipments = await api.equipmentsGet();
      state.equipments = equipments;
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to fetch equipments';
      console.error('Error fetching equipments:', err);
    } finally {
      state.loading = false;
    }
  };

  return html`<div>
    <h1>API Test Page</h1>
    <button @click="${fetchEquipments}" disabled="${() => state.loading}">
      ${() => state.loading ? 'Loading...' : 'Fetch Equipments'}
    </button>
    
    ${() => state.error ? html`<p style="color: red;">${state.error}</p>` : ''}
    
    ${() => state.equipments.length > 0 ? html`<div>
      <h2>Equipments</h2>
      <ul>
        ${() => state.equipments.map((equipment) => html`<li key="${equipment.id}">
          ${equipment.name} (ID: ${equipment.id})
        </li>`)}
      </ul>
    </div>` : ''}
  </div>`;
});