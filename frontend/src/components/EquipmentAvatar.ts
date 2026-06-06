import { html } from '@arrow-js/core'
import { Equipment } from '@generated/api/models/Equipment'

// equipmentAvatar renders an equipment's visual marker: its uploaded picture
// when one is set, otherwise the icon emoji (defaulting to 🔧). Used on the
// list cards and the dashboard. `size` selects a CSS size modifier; `bust` is
// an optional cache-busting token appended to the picture URL so a replaced
// picture reloads.
export function equipmentAvatar(eq: Equipment, size: 'sm' | 'lg' = 'sm', bust?: string | number) {
  const cls = 'equipment-avatar equipment-avatar--' + size
  if (eq.picture) {
    const q = bust != null ? '?v=' + encodeURIComponent(String(bust)) : ''
    const url = '/api/equipments/' + eq.id + '/picture' + q
    return html`<span class="${cls}"><img class="equipment-avatar__img" src="${url}" alt="${eq.name}" /></span>`
  }
  return html`<span class="${cls}"><span class="equipment-avatar__emoji">${eq.icon || '🔧'}</span></span>`
}
