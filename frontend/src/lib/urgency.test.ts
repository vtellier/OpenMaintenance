import { describe, expect, it } from 'vitest'
import { byUrgency } from '@/lib/urgency'

type T = Parameters<typeof byUrgency>[0]
const sorted = (tasks: T[]) => [...tasks].sort(byUrgency).map(t => t.name)

describe('byUrgency', () => {
  it('ranks by status first, whatever the urgency', () => {
    expect(sorted([
      { id: 1, name: 'ok', dueStatus: 'ok', urgency: 0.99 },
      { id: 2, name: 'soon', dueStatus: 'due_soon', urgency: 0.92 },
      { id: 3, name: 'late', dueStatus: 'overdue', urgency: 1.01 },
    ])).toEqual(['late', 'soon', 'ok'])
  })

  it('ranks by urgency within a status, highest first', () => {
    expect(sorted([
      { id: 1, name: 'a', dueStatus: 'overdue', urgency: 1.01 },
      { id: 2, name: 'b', dueStatus: 'overdue', urgency: 2.2 },
    ])).toEqual(['b', 'a'])
  })

  it('puts a task without urgency last within its status', () => {
    // Overdue only because it has no date baseline: no urgency fraction.
    expect(sorted([
      { id: 1, name: 'Aardvark never done', dueStatus: 'overdue', urgency: undefined },
      { id: 2, name: 'Zebra', dueStatus: 'overdue', urgency: 1.01 },
      { id: 3, name: 'Soon', dueStatus: 'due_soon', urgency: undefined },
    ])).toEqual(['Zebra', 'Aardvark never done', 'Soon'])
  })

  it('breaks ties by name, then id', () => {
    expect(sorted([
      { id: 3, name: 'b', dueStatus: 'overdue', urgency: 1 },
      { id: 2, name: 'a', dueStatus: 'overdue', urgency: 1 },
    ])).toEqual(['a', 'b'])
    const sameName: T[] = [
      { id: 2, name: 'a', dueStatus: 'overdue', urgency: 1 },
      { id: 1, name: 'a', dueStatus: 'overdue', urgency: 1 },
    ]
    expect(sameName.sort(byUrgency).map(t => t.id)).toEqual([1, 2])
  })
})
