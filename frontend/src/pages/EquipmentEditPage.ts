import { component, html, reactive } from '@arrow-js/core'
import { EquipmentApi, TaskApi, GroupApi } from '@generated/api'
import { Group } from '@generated/api/models/Group'
import { apiConfig } from '@/api/config'
import { iconPicker } from '@/components/IconPicker'
import { groupPicker } from '@/components/GroupPicker'
import { extractErrorMessage } from '@/lib/format'
import { fromApiDate, toApiDate } from '@/lib/calendar-date'

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
      icon: '🔧',
      groupId: null as number | null,
      groups: [] as Group[],
      commissionedAt: '',
      tracksHours: false,
      originalTracksHours: false,
      hours: 0,
      // Floor for the initial reading when turning the hour-meter on: the
      // reading kept from an earlier tracking period (the meter cannot go back).
      minHours: 0,
      loaded: false,
      saving: false,
      error: null as string | null,
      showConfirmTracks: false,
    })

    async function load() {
      try {
        const [eq, groups] = await Promise.all([
          equipmentApi.getEquipment({ id: equipmentId }),
          groupApi.listGroups(),
        ])
        state.groups = groups.map((g: any) => ({
          ...g,
          createdAt: g.createdAt?.toISOString(),
          updatedAt: g.updatedAt?.toISOString(),
        }))
        state.groupId = eq.groupId ?? null
        state.name = eq.name ?? ''
        state.description = eq.description ?? ''
        state.icon = eq.icon || '🔧'
        state.commissionedAt = fromApiDate(eq.commissionedAt) ?? ''
        state.tracksHours = eq.tracksHours ?? false
        state.originalTracksHours = state.tracksHours
        state.hours = eq.hours ?? 0
        state.minHours = eq.hours ?? 0
      } catch {
        state.error = 'Failed to load equipment'
      } finally {
        state.loaded = true
      }
    }

    load()

    // The form only asks for hours while turning the hour-meter on. Once it is
    // on, the reading changes through "Update hours", never through this form.
    const turningOn = () => state.tracksHours && !state.originalTracksHours
    const hoursTooLow = () => turningOn() && state.hours < state.minHours

    async function onSubmit(skipConfirmCheck = false) {
      if (!state.name.trim() || hoursTooLow()) return
      state.saving = true
      state.error = null

      if (state.tracksHours && !state.originalTracksHours && !skipConfirmCheck) {
        try {
          const tasks = await taskApi.listTasksByEquipment({ equipmentId })
          const hasHoursInterval = tasks.some(t => t.hoursInterval != null && t.hoursInterval > 0)
          if (hasHoursInterval) {
            state.showConfirmTracks = true
            state.saving = false
            return
          }
        } catch {
          // proceed without confirmation on error
        }
      }

      try {
        await equipmentApi.updateEquipment({
          id: equipmentId,
          equipmentInput: {
            name: state.name.trim(),
            description: state.description.trim() || undefined,
            icon: state.icon.trim() || undefined,
            groupId: state.groupId,
            commissionedAt: state.commissionedAt ? toApiDate(state.commissionedAt) : undefined,
            tracksHours: state.tracksHours,
            hours: turningOn() ? state.hours : undefined,
          },
        })
        window.location.href = backHref
      } catch (err) {
        state.error = await extractErrorMessage(err, 'Failed to save equipment')
        state.saving = false
      }
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
              <label class="form-field__label">Date of commissioning</label>
              <input type="date" .value="${() => state.commissionedAt}" @input="${(e: Event) => { state.commissionedAt = (e.target as HTMLInputElement).value }}" />
            </div>
            <div class="toggle-row">
              <span class="toggle-row__label">This equipment has an hour-meter</span>
              <label class="toggle-switch">
                <input type="checkbox" .checked="${() => state.tracksHours}" @change="${() => { state.tracksHours = !state.tracksHours }}" />
                <span class="toggle-slider"></span>
              </label>
            </div>
            ${() => turningOn() ? html`
              <div class="form-field">
                <label class="form-field__label">Current hours</label>
                <input type="number" min="${() => String(state.minHours)}" .value="${() => String(state.hours)}" @input="${(e: Event) => { state.hours = Number((e.target as HTMLInputElement).value) }}" />
                ${() => state.minHours > 0 ? html`<p class="form-field__hint">Last reading: ${String(state.minHours)} h. The hour-meter cannot go backwards.</p>` : null}
              </div>
            ` : null}
            <div class="form__actions">
              <a href="${backHref}" class="btn">Cancel</a>
              <button class="btn btn--accent" @click="${() => onSubmit()}" disabled="${() => state.saving || !state.name.trim() || hoursTooLow()}">
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
