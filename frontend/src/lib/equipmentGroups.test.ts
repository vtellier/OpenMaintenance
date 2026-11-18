import { describe, expect, it } from 'vitest'
import { equipmentList, equipmentStatus, groupStatus, interventionsFor } from '@/lib/equipmentGroups'

// Issue #112: the Equipments list shows group sections and ungrouped cards
// (doc/gui/equipments.md, "Layout").

type Lists = Parameters<typeof equipmentList>
const names = (entries: ReturnType<typeof equipmentList>) =>
  entries.map(e => e.kind === 'group'
    ? 'group ' + e.group.name + ' [' + e.equipments.map(eq => eq.name).join(', ') + ']'
    : e.equipment.name)

describe('equipmentList', () => {
  it('sorts groups and ungrouped equipments together, alphabetically ignoring case', () => {
    const groups: Lists[0] = [{ id: 1, name: 'Winches' }, { id: 2, name: 'safety gear' }]
    const equipments: Lists[1] = [
      { id: 1, name: 'Main engine' },
      { id: 2, name: 'Port winch', groupId: 1 },
      { id: 3, name: 'anchor' },
      { id: 4, name: 'Life jacket', groupId: 2 },
    ]
    expect(names(equipmentList(groups, equipments))).toEqual([
      'anchor',
      'Main engine',
      'group safety gear [Life jacket]',
      'group Winches [Port winch]',
    ])
  })

  it('sorts the equipments of a group alphabetically, ignoring case', () => {
    const groups: Lists[0] = [{ id: 1, name: 'Winches' }]
    const equipments: Lists[1] = [
      { id: 1, name: 'Starboard winch', groupId: 1 },
      { id: 2, name: 'cabin-top winch', groupId: 1 },
      { id: 3, name: 'Port winch', groupId: 1 },
    ]
    expect(names(equipmentList(groups, equipments))).toEqual([
      'group Winches [cabin-top winch, Port winch, Starboard winch]',
    ])
  })

  it('lists an empty group as a section with no equipment', () => {
    expect(names(equipmentList([{ id: 1, name: 'Sails' }], []))).toEqual(['group Sails []'])
  })

  it('puts a group before an equipment of the same name, and same-named equipments in creation order', () => {
    const groups: Lists[0] = [{ id: 1, name: 'Winches' }]
    const equipments: Lists[1] = [
      { id: 7, name: 'winches' },
      { id: 3, name: 'Winch', groupId: 1 },
      { id: 2, name: 'Winch', groupId: 1 },
    ]
    const list = equipmentList(groups, equipments)
    expect(names(list)).toEqual(['group Winches [Winch, Winch]', 'winches'])
    expect(list[0].kind === 'group' && list[0].equipments.map(eq => eq.id)).toEqual([2, 3])
  })

  it('shows an equipment whose group is unknown as ungrouped', () => {
    // e.g. its group was deleted in another tab since the list was loaded.
    expect(names(equipmentList([], [{ id: 1, name: 'Genoa', groupId: 9 }]))).toEqual(['Genoa'])
  })
})

// Issue #112: a section header shows the worst status among its equipments,
// derived like the card badges, so a collapsed group never hides an overdue
// equipment (doc/gui/equipments.md, "Section header").
describe('equipmentStatus', () => {
  it('is the worst status of the equipment\'s tasks, and none without a task', () => {
    expect(equipmentStatus([{ dueStatus: 'ok' }, { dueStatus: 'overdue' }, { dueStatus: 'due_soon' }])).toBe('overdue')
    expect(equipmentStatus([{ dueStatus: 'ok' }, { dueStatus: 'due_soon' }])).toBe('due_soon')
    expect(equipmentStatus([{ dueStatus: 'ok' }])).toBe('ok')
    expect(equipmentStatus([])).toBeNull()
  })
})

describe('groupStatus', () => {
  it('is the worst status among its equipments', () => {
    expect(groupStatus([[{ dueStatus: 'ok' }], [{ dueStatus: 'overdue' }], [{ dueStatus: 'due_soon' }]])).toBe('overdue')
    expect(groupStatus([[{ dueStatus: 'ok' }], [{ dueStatus: 'due_soon' }]])).toBe('due_soon')
  })

  it('ignores equipments with no task', () => {
    expect(groupStatus([[], [{ dueStatus: 'ok' }]])).toBe('ok')
  })

  it('is none when no equipment has a task, or the group is empty', () => {
    expect(groupStatus([[], []])).toBeNull()
    expect(groupStatus([])).toBeNull()
  })
})

// Issue #112: the History equipment filter also offers the groups; a group
// shows the interventions of all the equipments in it now
// (doc/gui/history.md, "Filters").
describe('interventionsFor', () => {
  const equipments = [
    { id: 1, name: 'Port winch', groupId: 10 },
    { id: 2, name: 'Starboard winch', groupId: 10 },
    { id: 3, name: 'Main engine' },
    { id: 4, name: 'Genoa', groupId: 20 },
  ]
  const tasks = [
    { id: 100, equipmentId: 1 },
    { id: 200, equipmentId: 2 },
    { id: 300, equipmentId: 3 },
  ]
  // A standard intervention is matched through its task (rows stored before
  // schema v3 have no equipment_id); an exceptional one by its equipment.
  const interventions = [
    { id: 1, taskId: 100 },
    { id: 2, taskId: 200, equipmentId: 2 },
    { id: 3, taskId: 300 },
    { id: 4, equipmentId: 2, exceptionalLabel: 'Replaced a pawl spring' },
    { id: 5, equipmentId: 3, exceptionalLabel: 'Replaced a belt' },
  ]
  const ids = (filter: Parameters<typeof interventionsFor>[1]) =>
    interventionsFor(interventions, filter, equipments, tasks).map(inv => inv.id)

  it('keeps every intervention without a filter', () => {
    expect(ids(null)).toEqual([1, 2, 3, 4, 5])
  })

  it('keeps the interventions of one equipment', () => {
    expect(ids({ equipmentId: 2 })).toEqual([2, 4])
  })

  it('keeps the interventions of all the equipments of a group', () => {
    expect(ids({ groupId: 10 })).toEqual([1, 2, 4])
  })

  it('keeps nothing for a group whose equipments have no intervention, or an empty group', () => {
    expect(ids({ groupId: 20 })).toEqual([])
    expect(ids({ groupId: 30 })).toEqual([])
  })
})
