import { describe, expect, it } from 'vitest'
import { decommissioningDateAllowed, equipmentLabel } from '@/lib/decommissioning'

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
