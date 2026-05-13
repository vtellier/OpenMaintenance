import { html } from '@arrow-js/core'

export function EquipmentDetailPage(id: string, tab: string) {
  const tabs = [
    { key: '', label: 'Tasks' },
    { key: 'history', label: 'History' },
    { key: 'info', label: 'Info' },
  ]

  return html`<section class="page">
    <a href="/equipments" class="back-link">&larr; Back to equipments</a>
    <h1>Equipment #${id}</h1>
    <nav class="sub-tabs">
      ${tabs.map(t => html`
        <a href="${'/equipments/' + id + (t.key ? '/' + t.key : '')}"
           class="${'sub-tab' + (tab === t.key ? ' active' : '')}">
          ${t.label}
        </a>
      `)}
    </nav>
    <div class="tab-content">
      ${tab === '' ? html`<p>Tasks for equipment #${id}</p>` : ''}
      ${tab === 'history' ? html`<p>Intervention history for equipment #${id}</p>` : ''}
      ${tab === 'info' ? html`<p>Equipment #${id} details and settings</p>` : ''}
    </div>
  </section>`
}
