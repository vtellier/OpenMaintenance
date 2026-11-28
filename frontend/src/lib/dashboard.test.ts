import { describe, expect, it } from 'vitest'
import { dueLine, dueTaskBlocks, isDue } from '@/lib/dashboard'

// The Dashboard lists the due tasks, one block per equipment
// (doc/gui/dashboard.md).

type Task = Parameters<typeof dueTaskBlocks>[0][number]

const blocks = (tasks: Task[]) =>
  dueTaskBlocks(tasks).map(b => b.equipmentId + ': ' + b.tasks.map(t => t.name).join(', '))

describe('isDue', () => {
  it('lists overdue and due soon tasks, never OK ones or ones with no due status', () => {
    expect(isDue({ dueStatus: 'overdue' })).toBe(true)
    expect(isDue({ dueStatus: 'due_soon' })).toBe(true)
    expect(isDue({ dueStatus: 'ok' })).toBe(false)
    // A decommissioned equipment's tasks have no due status.
    expect(isDue({})).toBe(false)
  })
})

describe('dueTaskBlocks', () => {
  it('groups the due tasks by equipment and leaves out the others', () => {
    expect(blocks([
      { id: 1, name: 'Oil change', equipmentId: 1, dueStatus: 'overdue', urgency: 2 },
      { id: 2, name: 'Impeller', equipmentId: 1, dueStatus: 'ok', urgency: 0.1 },
      { id: 3, name: 'Grease hubs', equipmentId: 2, dueStatus: 'due_soon', urgency: 0.9 },
      { id: 4, name: 'Antifouling', equipmentId: 3, dueStatus: 'ok', urgency: 0.5 },
    ])).toEqual(['1: Oil change', '2: Grease hubs'])
  })

  it('sorts the tasks of a block by urgency: overdue first, then the highest urgency', () => {
    expect(blocks([
      { id: 1, name: 'Belt', equipmentId: 1, dueStatus: 'due_soon', urgency: 0.95 },
      { id: 2, name: 'Oil change', equipmentId: 1, dueStatus: 'overdue', urgency: 1.1 },
      { id: 3, name: 'Impeller', equipmentId: 1, dueStatus: 'overdue', urgency: 1.8 },
      { id: 4, name: 'Anodes', equipmentId: 1, dueStatus: 'due_soon' },
    ])).toEqual(['1: Impeller, Oil change, Belt, Anodes'])
  })

  it('orders the blocks by their most urgent task', () => {
    expect(blocks([
      { id: 1, name: 'Grease hubs', equipmentId: 2, dueStatus: 'due_soon', urgency: 0.99 },
      { id: 2, name: 'Oil change', equipmentId: 1, dueStatus: 'due_soon', urgency: 0.8 },
      { id: 3, name: 'Impeller', equipmentId: 3, dueStatus: 'overdue', urgency: 1.2 },
      { id: 4, name: 'Belt', equipmentId: 1, dueStatus: 'overdue', urgency: 1.5 },
    ])).toEqual(['1: Belt, Oil change', '3: Impeller', '2: Grease hubs'])
  })

  it('breaks a tie in urgency by name, then by id, as urgency order does', () => {
    expect(blocks([
      { id: 5, name: 'Oil change', equipmentId: 2, dueStatus: 'overdue', urgency: 1.5 },
      { id: 6, name: 'Belt', equipmentId: 3, dueStatus: 'overdue', urgency: 1.5 },
      { id: 4, name: 'Oil change', equipmentId: 1, dueStatus: 'overdue', urgency: 1.5 },
    ])).toEqual(['3: Belt', '1: Oil change', '2: Oil change'])
  })

  it('leaves out a due task with no equipment', () => {
    expect(blocks([
      { id: 1, name: 'Orphan', dueStatus: 'overdue', urgency: 3 },
      { id: 2, name: 'Oil change', equipmentId: 1, dueStatus: 'overdue', urgency: 1 },
    ])).toEqual(['1: Oil change'])
  })

  it('has no block when nothing is due', () => {
    expect(dueTaskBlocks([])).toEqual([])
    expect(dueTaskBlocks([{ id: 1, name: 'Oil change', equipmentId: 1, dueStatus: 'ok', urgency: 0.2 }])).toEqual([])
  })

  it('does not reorder the list it is given', () => {
    const tasks: Task[] = [
      { id: 1, name: 'B', equipmentId: 1, dueStatus: 'due_soon', urgency: 0.9 },
      { id: 2, name: 'A', equipmentId: 1, dueStatus: 'overdue', urgency: 1.2 },
    ]
    dueTaskBlocks(tasks)
    expect(tasks.map(t => t.name)).toEqual(['B', 'A'])
  })
})

describe('dueLine', () => {
  it('an overdue task is red, with its status label and timing text', () => {
    expect(dueLine({ dueStatus: 'overdue', dueTrigger: 'months', dueInDays: -3 }))
      .toEqual({ className: 'due-indicator due-indicator--overdue', text: 'Overdue — 3d ago' })
  })

  it('a task due soon is amber', () => {
    expect(dueLine({ dueStatus: 'due_soon', dueTrigger: 'hours', dueInHours: 80 }))
      .toEqual({ className: 'due-indicator due-indicator--due-soon', text: 'Due soon — in 80 h' })
  })

  it('never leaves the status label dangling: a task never done reads "never done"', () => {
    expect(dueLine({ dueStatus: 'overdue', dueTrigger: 'months' }).text).toBe('Overdue — never done')
  })
})
