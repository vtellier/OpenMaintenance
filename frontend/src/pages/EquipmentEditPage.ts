import { component, html, reactive } from '@arrow-js/core'
import { EquipmentApi, TaskApi, GroupApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { iconPicker } from '@/components/IconPicker'
import { groupPicker } from '@/components/GroupPicker'
import { today } from '@/lib/calendar-date'
import { GroupRow, toEquipmentRow, toGroupRow } from '@/lib/rows'
import { hoursFromInput } from '@/lib/hoursForm'
import { canSaveEdit, decommissioningInvalid, DEFAULT_ICON, editFormOf, saveEdit, turningOn } from '@/lib/equipmentForm'

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)
const groupApi = new GroupApi(apiConfig)

export function EquipmentEditPage(idParam: string) {
  const equipmentId = parseInt(idParam, 10)
  const backHref = '/equipments/' + equipmentId

  return component(() => {
    const state = reactive({
      name: '',
      description: '',
      icon: DEFAULT_ICON,
      groupId: null as number | null,
      groups: [] as GroupRow[],
      commissionedAt: '',
      // '' while the equipment is in service.
      decommissionedAt: '',
      tracksHours: false,
      originalTracksHours: false,
      hours: 0,
      // The floor for the reading when turning the hour-meter on (equipmentForm.ts).
      minHours: 0,
      loaded: false,
      saving: false,
      error: null as string | null,
      showConfirmTracks: false,
    })

    async function load() {
      try {
        const [equipment, groups] = await Promise.all([
          equipmentApi.getEquipment({ id: equipmentId }),
          groupApi.listGroups(),
        ])
        state.groups = groups.map(toGroupRow)
        Object.assign(state, editFormOf(toEquipmentRow(equipment)))
      } catch {
        state.error = 'Failed to load equipment'
      } finally {
        state.loaded = true
      }
    }

    load()

    // Read from the state on each call, so a slot that calls it updates.
    const canSave = () => canSaveEdit(state, today())

    // confirmed: the user has confirmed turning the hour-meter on.
    async function onSubmit(confirmed = false) {
      if (!canSave()) return
      state.saving = true
      state.error = null
      const result = await saveEdit(state, equipmentId, { equipments: equipmentApi, tasks: taskApi }, confirmed)
      if ('saved' in result) {
        window.location.href = backHref
        return
      }
      if ('needsConfirmation' in result) state.showConfirmTracks = true
      else state.error = result.error
      state.saving = false
    }

    return html`<section class="page">
      <a href="${backHref}" class="back-link">&larr; Back</a>

      ${() => {
        if (!state.loaded) return html`<p class="page__empty">Loading...</p>`
        if (state.error && !state.name) return html`<div class="flash flash--error">${state.error}</div>`

        return html`
          <h1>Edit equipment</h1>

          ${() => state.error ? html`<div class="flash flash--error">${state.error}</div>` : null}

          <div class="form-page">
            <div class="form-field">
              <label class="form-field__label">Name *</label>
              <input placeholder="e.g. Main Engine" .value="${() => state.name}" @input="${(e: Event) => { state.name = (e.target as HTMLInputElement).value }}" />
            </div>
            <div class="form-field">
              <label class="form-field__label">Description</label>
              <textarea placeholder="Optional description" .value="${() => state.description}" @input="${(e: Event) => { state.description = (e.target as HTMLTextAreaElement).value }}"></textarea>
            </div>
            <div class="form-field">
              <label class="form-field__label">Icon</label>
              ${iconPicker(() => state.icon, (v) => { state.icon = v })}
              <p class="form-field__hint">Shown in lists and the dashboard. Defaults to 🔧.</p>
            </div>
            <div class="form-field">
              <label class="form-field__label">Group</label>
              ${groupPicker({
                groups: () => state.groups,
                current: () => state.groupId,
                onSelect: (id) => { state.groupId = id },
                onCreated: (g) => { state.groups = [...state.groups, g] },
              })}
            </div>
            <div class="form-field">
              <label class="form-field__label" for="commissioned-at">Date of commissioning</label>
              <input id="commissioned-at" type="date" .value="${() => state.commissionedAt}" @input="${(e: Event) => { state.commissionedAt = (e.target as HTMLInputElement).value }}" />
            </div>
            <div class="form-field">
              <label class="form-field__label" for="decommissioned-at">Decommissioned on</label>
              <input id="decommissioned-at" type="date" min="${() => state.commissionedAt}" max="${() => today()}" .value="${() => state.decommissionedAt}" @input="${(e: Event) => { state.decommissionedAt = (e.target as HTMLInputElement).value }}" />
              <p class="form-field__hint">Set when the equipment leaves service. Its tasks are no longer due; its history is kept.</p>
              ${() => decommissioningInvalid(state, today()) ? html`<p class="form-field__error">Cannot be after today, nor before the date of commissioning.</p>` : null}
            </div>
            <div class="toggle-row">
              <span class="toggle-row__label">This equipment has an hour-meter</span>
              <label class="toggle-switch">
                <input type="checkbox" aria-label="This equipment has an hour-meter" .checked="${() => state.tracksHours}" @change="${() => { state.tracksHours = !state.tracksHours }}" />
                <span class="toggle-slider"></span>
              </label>
            </div>
            ${() => turningOn(state) ? html`
              <div class="form-field">
                <label class="form-field__label">Current hours</label>
                <input type="number" aria-label="Current hours" min="${() => String(state.minHours)}" .value="${() => String(state.hours)}" @input="${(e: Event) => { state.hours = hoursFromInput((e.target as HTMLInputElement).value) }}" />
                ${() => state.minHours > 0 ? html`<p class="form-field__hint">Last reading: ${String(state.minHours)} h. The hour-meter cannot go backwards.</p>` : null}
              </div>
            ` : null}
            <div class="form__actions">
              <a href="${backHref}" class="btn">Cancel</a>
              <button class="btn btn--accent" @click="${() => onSubmit()}" disabled="${() => state.saving || !canSave()}">
                ${() => state.saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          ${() => state.showConfirmTracks ? html`
            <div class="modal-overlay" @click="${() => { state.showConfirmTracks = false }}">
              <div class="modal">
                <h2 class="modal__title">Enable hour-meter tracking?</h2>
                <p class="confirm-text">This equipment has tasks with hour-based intervals. Enabling hour-meter tracking will link those intervals to the equipment's hour-meter.</p>
                <div class="modal__actions">
                  <button class="btn" @click="${() => { state.showConfirmTracks = false }}">Cancel</button>
                  <button class="btn btn--accent" @click="${() => { state.showConfirmTracks = false; onSubmit(true) }}">Enable</button>
                </div>
              </div>
            </div>
          ` : null}
        `
      }}
    </section>`
  })()
}
