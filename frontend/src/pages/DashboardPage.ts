import { component, html, reactive } from '@arrow-js/core'
import { Equipment } from '@generated/api/models/Equipment'
import { EquipmentApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { relativeTime, formatHours, isHoursStale, isHoursVeryStale } from '@/lib/format'

const equipmentApi = new EquipmentApi(apiConfig)

export function DashboardPage() {
  return component(() => {
    const state = reactive({
      equipments: [] as Equipment[],
      loaded: false,
      loadError: null as string | null,
      bannerShowFresh: true,
    })

    async function load() {
      try {
        const eqs = await equipmentApi.listEquipments()
        state.equipments = eqs.map((e: any) => ({
          ...e,
          hoursUpdatedAt: e.hoursUpdatedAt?.toISOString(),
          createdAt: e.createdAt?.toISOString(),
          updatedAt: e.updatedAt?.toISOString(),
        }))
      } catch {
        state.loadError = 'Failed to load data'
      } finally {
        state.loaded = true
      }
    }

    load()

    const hourTrackedEquipments = () => {
      return [...state.equipments]
        .filter(eq => eq.tracksHours)
        .sort((a, b) => {
          const timeA = a.hoursUpdatedAt ? new Date(a.hoursUpdatedAt).getTime() : 0
          const timeB = b.hoursUpdatedAt ? new Date(b.hoursUpdatedAt).getTime() : 0
          return timeA - timeB
        })
    }

    const staleHourEquipments = () => {
      return hourTrackedEquipments().filter(eq => isHoursStale(eq.hoursUpdatedAt))
    }

    const freshHourEquipments = () => {
      return hourTrackedEquipments().filter(eq => !isHoursStale(eq.hoursUpdatedAt))
    }

    function toggleBannerFresh() {
      state.bannerShowFresh = !state.bannerShowFresh
    }

    return html`<section class="page">
      <h1>Dashboard</h1>

      ${() => {
        if (!state.loaded) return html`<p class="page__empty">Loading...</p>`
        if (state.loadError) return html`<div class="flash flash--error">${state.loadError}</div>`

        const hourEqs = hourTrackedEquipments()

        return html`
          ${hourEqs.length > 0 ? hoursBanner() : null}
          <p class="page__empty">You're all caught up. Nothing due right now.</p>
        `
      }}
    </section>`

    function hoursBanner() {
      const staleEqsList = staleHourEquipments()
      const freshEqsList = freshHourEquipments()
      const showFresh = state.bannerShowFresh

      return html`<div class="hours-banner">
        <div class="hours-banner__header" @click="${toggleBannerFresh}">
          <span class="hours-banner__title">Keep your hour-meters fresh</span>
          ${freshEqsList.length > 0 ? html`<span class="hours-banner__toggle">${showFresh ? 'Hide fresh' : 'Show fresh'}</span>` : null}
        </div>
        <div class="hours-banner__list">
          ${staleEqsList.map(eq => hoursBannerRow(eq))}
          ${showFresh ? freshEqsList.map(eq => hoursBannerRow(eq)) : null}
        </div>
      </div>`
    }

    function hoursBannerRow(eq: Equipment) {
      const eqHref = '/equipments/' + eq.id
      const updateHref = '/equipments/' + eq.id + '/edit/hours'
      const stale = isHoursStale(eq.hoursUpdatedAt)
      const rowClass = 'hours-banner__row' + (stale ? ' hours-banner__row--stale' : '')
      const freshnessClass = isHoursVeryStale(eq.hoursUpdatedAt) ? ' very-stale' : stale ? ' stale' : ''
      const updatedClass = 'hours-banner__updated' + freshnessClass

      return html`<div class="${rowClass}">
        <a href="${eqHref}" class="hours-banner__eq-name">${eq.name}</a>
        <span class="hours-banner__hours">${formatHours(eq.hours)}</span>
        <span class="${updatedClass}">updated ${relativeTime(eq.hoursUpdatedAt)}</span>
        <a href="${updateHref}" class="btn btn--small">Update</a>
      </div>`
    }
  })()
}
