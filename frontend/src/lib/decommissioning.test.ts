import { describe, expect, it } from 'vitest'
import { decommissionedCount, decommissioningDateAllowed, equipmentLabel } from '@/lib/decommissioning'

// Issue #113: pickers still list a decommissioned equipment, marked
// (doc/gui/history.md, "Filters"; doc/gui/interventions.md, "Fields").
describe('equipmentLabel', () => {
  it('marks a decommissioned equipment', () => {
    expect(equipmentLabel({ name: 'Old dinghy', decommissionedAt: '2024-09-30' })).toBe('Old dinghy (decommissioned)')
    expect(equipmentLabel({ name: 'Main engine' })).toBe('Main engine')
  })
})

// Issue #113: the edit form's "Decommissioned on" cannot be after today nor
// before the date of commissioning; Save is disabled meanwhile
// (doc/gui/equipments.md, "Flow: Decommission an equipment").
describe('decommissioningDateAllowed', () => {
  const today = '2026-11-18'

  it('allows no date: the equipment is in service', () => {
    expect(decommissioningDateAllowed('', '2020-05-01', today)).toBe(true)
  })

  it('allows today and any past date', () => {
    expect(decommissioningDateAllowed('2026-11-18', '', today)).toBe(true)
    expect(decommissioningDateAllowed('1999-01-01', '', today)).toBe(true)
  })

  it('refuses a date after today', () => {
    expect(decommissioningDateAllowed('2026-11-19', '', today)).toBe(false)
  })

  it('allows the date of commissioning itself, and refuses the day before', () => {
    expect(decommissioningDateAllowed('2020-05-01', '2020-05-01', today)).toBe(true)
    expect(decommissioningDateAllowed('2020-04-30', '2020-05-01', today)).toBe(false)
  })
})

// The Equipments list's "Show decommissioned (2)" (doc/gui/equipments.md,
// "Decommissioned equipments").
describe('decommissionedCount', () => {
  it('counts the equipments with a decommissioning date', () => {
    expect(decommissionedCount([{ decommissionedAt: '2024-09-30' }, {}, { decommissionedAt: null }, { decommissionedAt: '2025-01-02' }])).toBe(2)
  })

  it('is 0 when every equipment is in service', () => {
    expect(decommissionedCount([{}, { decommissionedAt: '' }])).toBe(0)
  })
})
