import { describe, expect, it } from 'vitest'
import { filterValue, historyEmptyText, historyItemLabel, historyList, inDateRange, parseFilterValue } from '@/lib/history'

// The History screen's list and filters (doc/gui/history.md).

const ids = (list: { id?: number }[]) => list.map(inv => inv.id)

describe('the equipment filter value', () => {
  it('is "" for all equipments, "<id>" for an equipment, "g:<id>" for a group', () => {
    expect(filterValue(null)).toBe('')
    expect(filterValue({ equipmentId: 7 })).toBe('7')
    expect(filterValue({ groupId: 3 })).toBe('g:3')
  })

  it('reads back the filter it stands for', () => {
    for (const filter of [null, { equipmentId: 7 }, { groupId: 3 }, { equipmentId: 0 }, { groupId: 0 }]) {
      expect(parseFilterValue(filterValue(filter))).toEqual(filter)
    }
  })

  it('never reads a group id as an equipment id, or the other way round', () => {
    expect(parseFilterValue('3')).toEqual({ equipmentId: 3 })
    expect(parseFilterValue('g:3')).toEqual({ groupId: 3 })
  })

  it('reads a value it cannot make sense of as all equipments', () => {
    expect(parseFilterValue('')).toBeNull()
    expect(parseFilterValue('g:')).toBeNull()
    expect(parseFilterValue('g:abc')).toBeNull()
    expect(parseFilterValue('abc')).toBeNull()
  })

  // parseInt reads the leading digits: today a trailing junk is ignored.
  it('reads the leading digits of a value', () => {
    expect(parseFilterValue('12abc')).toEqual({ equipmentId: 12 })
    expect(parseFilterValue('g:4x')).toEqual({ groupId: 4 })
  })
})

describe('inDateRange', () => {
  const interventions = [
    { id: 1, date: '2026-01-31' },
    { id: 2, date: '2026-02-01' },
    { id: 3, date: '2026-02-15' },
    { id: 4, date: '2026-02-28' },
    { id: 5, date: '2026-03-01' },
    { id: 6 },
  ]

  it('keeps everything, undated included, with no range', () => {
    expect(ids(inDateRange(interventions, '', ''))).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('includes both ends of the range', () => {
    expect(ids(inDateRange(interventions, '2026-02-01', '2026-02-28'))).toEqual([2, 3, 4])
  })

  it('leaves an end open when it is not set', () => {
    expect(ids(inDateRange(interventions, '2026-02-28', ''))).toEqual([4, 5])
    expect(ids(inDateRange(interventions, '', '2026-02-01'))).toEqual([1, 2])
  })

  it('leaves out the undated interventions once an end is set', () => {
    expect(ids(inDateRange(interventions, '2000-01-01', ''))).not.toContain(6)
    expect(ids(inDateRange(interventions, '', '2999-12-31'))).not.toContain(6)
  })

  it('keeps a single day', () => {
    expect(ids(inDateRange(interventions, '2026-02-15', '2026-02-15'))).toEqual([3])
  })

  it('keeps nothing for a range that ends before it starts', () => {
    expect(inDateRange(interventions, '2026-02-28', '2026-02-01')).toEqual([])
  })
})

describe('historyList', () => {
  const equipments = [
    { id: 1, name: 'Port winch', groupId: 10 },
    { id: 2, name: 'Main engine' },
  ]
  const tasks = [
    { id: 100, name: 'Grease', equipmentId: 1 },
    { id: 200, name: 'Oil change', equipmentId: 2 },
  ]
  const interventions = [
    { id: 1, taskId: 100, equipmentId: 1, date: '2026-03-01' },
    { id: 2, taskId: 200, equipmentId: 2, date: '2026-05-10' },
    { id: 3, equipmentId: 1, exceptionalLabel: 'Broken pawl', date: '2026-04-02' },
    { id: 4, taskId: 200, equipmentId: 2, date: '2026-01-15' },
  ]

  it('lists every intervention newest first with no filter', () => {
    expect(ids(historyList(interventions, { filter: null, from: '', to: '' }, equipments, tasks))).toEqual([2, 3, 1, 4])
  })

  it('applies the equipment filter and the date range together', () => {
    expect(ids(historyList(interventions, { filter: { equipmentId: 2 }, from: '2026-02-01', to: '' }, equipments, tasks))).toEqual([2])
    expect(ids(historyList(interventions, { filter: { groupId: 10 }, from: '', to: '2026-03-31' }, equipments, tasks))).toEqual([1])
  })

  it('is empty when nothing matches, or nothing is logged', () => {
    expect(historyList(interventions, { filter: { equipmentId: 2 }, from: '2026-06-01', to: '' }, equipments, tasks)).toEqual([])
    expect(historyList([], { filter: null, from: '', to: '' }, equipments, tasks)).toEqual([])
  })

  it('returns a new list and leaves the one given unchanged', () => {
    const list = historyList(interventions, { filter: null, from: '', to: '' }, equipments, tasks)
    expect(list).not.toBe(interventions)
    expect(ids(interventions)).toEqual([1, 2, 3, 4])
  })
})

describe('historyItemLabel', () => {
  const equipments = [{ id: 1, name: 'Port winch' }, { id: 2, name: 'Main engine' }, { id: 3 }]
  const tasks = [
    { id: 100, name: 'Grease', equipmentId: 1 },
    { id: 200, equipmentId: 2 },
    { id: 300, name: 'Orphan task' },
    { id: 400, name: 'Ghost task', equipmentId: 99 },
  ]

  it("names a standard intervention's equipment, from its task, and its task", () => {
    expect(historyItemLabel({ taskId: 100, equipmentId: 1 }, equipments, tasks)).toBe('Port winch / Grease')
  })

  it("names an exceptional intervention's equipment and its label", () => {
    expect(historyItemLabel({ equipmentId: 2, exceptionalLabel: 'Broken belt' }, equipments, tasks)).toBe('Main engine / Broken belt')
  })

  it('leaves out what is unknown or unnamed', () => {
    expect(historyItemLabel({ taskId: 200 }, equipments, tasks)).toBe('Main engine')
    expect(historyItemLabel({ taskId: 300 }, equipments, tasks)).toBe('Orphan task')
    expect(historyItemLabel({ taskId: 400 }, equipments, tasks)).toBe('Ghost task')
    expect(historyItemLabel({ taskId: 999, equipmentId: 1 }, equipments, tasks)).toBe('')
    expect(historyItemLabel({ equipmentId: 3, exceptionalLabel: 'Dent' }, equipments, tasks)).toBe('Dent')
    expect(historyItemLabel({ equipmentId: 99 }, equipments, tasks)).toBe('')
  })
})

describe('historyEmptyText', () => {
  it('says nothing is logged yet when there is no equipment', () => {
    expect(historyEmptyText(0)).toBe("No interventions logged yet. Once you add equipments and mark tasks as done, they'll appear here.")
  })

  // #170: with equipments but nothing logged, the doc says nothing is logged
  // yet; the app says the filters match nothing. Kept until it is fixed.
  it('says the filters match nothing once there is an equipment', () => {
    expect(historyEmptyText(3)).toBe('No interventions match your filters.')
  })
})
