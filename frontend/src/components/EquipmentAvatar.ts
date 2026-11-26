import { html } from '@arrow-js/core'
import { Equipment } from '@generated/api/models/Equipment'
import { DEFAULT_ICON } from '@/lib/equipmentForm'

// equipmentAvatar renders an equipment's icon emoji (defaults to 🔧). Used
// wherever an equipment is referenced — the list cards and the dashboard.
export function equipmentAvatar(eq: Pick<Equipment, 'icon'>, size: 'sm' | 'lg' = 'sm') {
  const cls = 'equipment-avatar equipment-avatar--' + size
  return html`<span class="${cls}"><span class="equipment-avatar__emoji">${eq.icon || DEFAULT_ICON}</span></span>`
}
