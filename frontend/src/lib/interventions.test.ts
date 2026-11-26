import { describe, expect, it } from 'vitest'
import {
  belongsTo, equipmentInterventions, interventionOwner, interventionTaskLabel, lastInterventionOfTask, latestEquipmentIntervention,
  latestIntervention, newestFirst, taskName,
} from '@/lib/interventions'

const oilChange = { id: 10, name: 'Oil change', equipmentId: 1 }
const impeller = { id: 11, name: 'Impeller', equipmentId: 1 }
const greaseHubs = { id: 20, name: 'Grease hubs', equipmentId: 2 }
const engineTasks = [oilChange, impeller]
const allTasks = [oilChange, impeller, greaseHubs]

const ids = (list: { id?: number }[]) => list.map(inv => inv.id)

describe('belongsTo', () => {
  const owner = interventionOwner([1], engineTasks)

  it('takes a standard intervention through its task, whatever its equipmentId', () => {
    expect(belongsTo({ taskId: 10, equipmentId: 1 }, owner)).toBe(true)
    expect(belongsTo({ taskId: 11, equipmentId: 99 }, owner)).toBe(true)
    expect(belongsTo({ taskId: 20, equipmentId: 1 }, owner)).toBe(false)
  })

  it('takes an exceptional intervention through its own equipment', () => {
    expect(belongsTo({ equipmentId: 1 }, owner)).toBe(true)
    expect(belongsTo({ taskId: null, equipmentId: 1 }, owner)).toBe(true)
    expect(belongsTo({ equipmentId: 2 }, owner)).toBe(false)
  })

  it('keeps an exceptional intervention with no equipment out', () => {
    expect(belongsTo({}, owner)).toBe(false)
    expect(belongsTo({ equipmentId: null }, owner)).toBe(false)
  })

  it('keeps everything out of an empty owner', () => {
    const none = interventionOwner([], [])
    expect(belongsTo({ taskId: 10 }, none)).toBe(false)
    expect(belongsTo({ equipmentId: 1 }, none)).toBe(false)
  })
})

describe('equipmentInterventions', () => {
  const interventions = [
    { id: 1, taskId: 10, equipmentId: 1, date: '2026-03-01' },
    { id: 2, taskId: 20, equipmentId: 2, date: '2026-03-02' },
    { id: 3, equipmentId: 1, exceptionalLabel: 'Broken belt', date: '2026-03-03' },
    { id: 4, equipmentId: 2, exceptionalLabel: 'Dent', date: '2026-03-04' },
    { id: 5, taskId: 11, equipmentId: 1, date: '2026-03-05' },
  ]

  it("keeps the interventions on the equipment's tasks and its exceptional ones, in the order given", () => {
    expect(ids(equipmentInterventions(interventions, 1, engineTasks))).toEqual([1, 3, 5])
  })

  it("decides a standard intervention by its task, not by the equipment it carries", () => {
    // A task moved to another equipment can leave its interventions'
    // equipment behind (#85): the intervention follows its task.
    const moved = [{ id: 6, taskId: 20, equipmentId: 1, date: '2026-03-06' }]
    expect(ids(equipmentInterventions(moved, 1, engineTasks))).toEqual([])
    expect(ids(equipmentInterventions(moved, 2, [greaseHubs]))).toEqual([6])
  })

  it('keeps only the exceptional interventions of an equipment with no task', () => {
    expect(ids(equipmentInterventions(interventions, 2, []))).toEqual([4])
  })

  it('keeps nothing for an equipment with no intervention', () => {
    expect(equipmentInterventions(interventions, 3, [])).toEqual([])
    expect(equipmentInterventions([], 1, engineTasks)).toEqual([])
  })
})

describe('latestIntervention', () => {
  it('is the one with the latest date', () => {
    expect(latestIntervention([
      { id: 1, date: '2026-03-01' },
      { id: 2, date: '2026-05-10' },
      { id: 3, date: '2025-12-31' },
    ])?.id).toBe(2)
  })

  it('is the first one in the list when two share the latest date', () => {
    expect(latestIntervention([
      { id: 1, date: '2026-03-01' },
      { id: 2, date: '2026-05-10' },
      { id: 3, date: '2026-05-10' },
    ])?.id).toBe(2)
  })

  it('counts an intervention with no date as older than any dated one', () => {
    expect(latestIntervention([{ id: 1 }, { id: 2, date: '2020-01-01' }])?.id).toBe(2)
    const undated: { id: number, date?: string }[] = [{ id: 1 }, { id: 2 }]
    expect(latestIntervention(undated)?.id).toBe(1)
  })

  it('is none for no intervention', () => {
    expect(latestIntervention([])).toBeNull()
  })
})

describe('lastInterventionOfTask', () => {
  const interventions = [
    { id: 1, taskId: 10, date: '2026-03-01' },
    { id: 2, taskId: 11, date: '2026-06-01' },
    { id: 3, taskId: 10, date: '2026-04-01' },
    { id: 4, equipmentId: 1, exceptionalLabel: 'Broken belt', date: '2026-07-01' },
  ]

  it("is the task's latest intervention", () => {
    expect(lastInterventionOfTask(interventions, 10)?.id).toBe(3)
    expect(lastInterventionOfTask(interventions, 11)?.id).toBe(2)
  })

  it('is none for a task never done, an unknown task, or no task id', () => {
    expect(lastInterventionOfTask(interventions, 12)).toBeNull()
    expect(lastInterventionOfTask(interventions, 999)).toBeNull()
    expect(lastInterventionOfTask(interventions, undefined)).toBeNull()
    expect(lastInterventionOfTask(interventions, null)).toBeNull()
  })
})

describe('latestEquipmentIntervention', () => {
  it("is the latest intervention on one of the equipment's tasks", () => {
    expect(latestEquipmentIntervention([
      { id: 1, taskId: 10, date: '2026-03-01' },
      { id: 2, taskId: 20, date: '2026-09-01' },
      { id: 3, taskId: 11, date: '2026-04-01' },
    ], engineTasks)?.id).toBe(3)
  })

  // Today's rule, which #179 questions: an exceptional intervention never
  // counts, even when it is the most recent one, or the only one.
  it('does not count exceptional interventions (#179)', () => {
    expect(latestEquipmentIntervention([
      { id: 1, taskId: 10, equipmentId: 1, date: '2026-03-01' },
      { id: 2, equipmentId: 1, exceptionalLabel: 'Broken belt', date: '2026-08-01' },
    ], engineTasks)?.id).toBe(1)
    expect(latestEquipmentIntervention([
      { id: 2, equipmentId: 1, exceptionalLabel: 'Broken belt', date: '2026-08-01' },
    ], [])).toBeNull()
  })

  it('is none for an equipment with no task or no intervention', () => {
    expect(latestEquipmentIntervention([{ id: 1, taskId: 10, date: '2026-03-01' }], [])).toBeNull()
    expect(latestEquipmentIntervention([], engineTasks)).toBeNull()
  })
})

describe('taskName', () => {
  it("is the task's name", () => {
    expect(taskName(allTasks, 20)).toBe('Grease hubs')
  })

  it('is empty for an unknown task, no task id, or a task with no name', () => {
    expect(taskName(allTasks, 999)).toBe('')
    expect(taskName(allTasks, undefined)).toBe('')
    expect(taskName([{ id: 30 }], 30)).toBe('')
  })
})

describe('interventionTaskLabel', () => {
  it("is the task's name for a standard intervention", () => {
    expect(interventionTaskLabel({ taskId: 10 }, allTasks)).toBe('Oil change')
  })

  it('is the label of an exceptional intervention', () => {
    expect(interventionTaskLabel({ equipmentId: 1, exceptionalLabel: 'Broken belt' }, allTasks)).toBe('Broken belt')
    expect(interventionTaskLabel({ equipmentId: 1 }, allTasks)).toBe('')
  })

  it('is empty for an unknown task', () => {
    expect(interventionTaskLabel({ taskId: 999 }, allTasks)).toBe('')
  })
})

describe('newestFirst', () => {
  it('lists the newest first', () => {
    expect(ids(newestFirst([
      { id: 1, date: '2026-03-01' },
      { id: 2, date: '2026-05-10' },
      { id: 3, date: '2025-12-31' },
    ]))).toEqual([2, 1, 3])
  })

  it('keeps the order given for the same date, and lists those with no date last', () => {
    expect(ids(newestFirst([
      { id: 1 },
      { id: 2, date: '2026-05-10' },
      { id: 3, date: '2026-05-10' },
      { id: 4, date: '2026-06-01' },
    ]))).toEqual([4, 2, 3, 1])
  })

  it('returns a new list and leaves the one given unchanged', () => {
    const list = [{ id: 1, date: '2026-03-01' }, { id: 2, date: '2026-05-10' }]
    const sorted = newestFirst(list)
    expect(sorted).not.toBe(list)
    expect(ids(list)).toEqual([1, 2])
  })
})
