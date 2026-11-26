import { describe, expect, it } from 'vitest'
import { ResponseError } from '@generated/api/runtime'
import {
  canSaveTask, intervalFromInput, intervalValue, kindFields, newTaskForm, saveTask, TaskFormValues, taskFormOf, TaskSaver, toTaskInput,
} from '@/lib/taskForm'

const oilChange: TaskFormValues = {
  name: 'Oil change', description: '', kind: 'interval', hoursInterval: 100, monthsInterval: 12, currentExpiryDate: '',
}
const flare: TaskFormValues = {
  name: 'Replace flare', description: '', kind: 'expiry', hoursInterval: 0, monthsInterval: 0, currentExpiryDate: '2029-03-31',
}

describe('newTaskForm', () => {
  it('opens Add task empty, as an interval task', () => {
    expect(newTaskForm()).toEqual({
      name: '', description: '', kind: 'interval', hoursInterval: 0, monthsInterval: 0, currentExpiryDate: '',
    })
  })
})

describe('taskFormOf', () => {
  it("opens Edit task with an interval task's values", () => {
    expect(taskFormOf({ id: 1, equipmentId: 1, name: 'Oil change', description: 'Engine oil', kind: 'interval', hoursInterval: 100, monthsInterval: 12 }))
      .toEqual({ name: 'Oil change', description: 'Engine oil', kind: 'interval', hoursInterval: 100, monthsInterval: 12, currentExpiryDate: '' })
  })

  it("opens Edit task with an expiry task's current expiry date", () => {
    expect(taskFormOf({ id: 2, equipmentId: 1, name: 'Replace flare', kind: 'expiry', currentExpiryDate: '2029-03-31' }))
      .toEqual({ name: 'Replace flare', description: '', kind: 'expiry', hoursInterval: 0, monthsInterval: 0, currentExpiryDate: '2029-03-31' })
  })

  it('reads a task with no kind as an interval task, and a missing interval as none', () => {
    expect(taskFormOf({ id: 3, equipmentId: 1, name: 'Grease' })).toMatchObject({ kind: 'interval', hoursInterval: 0, monthsInterval: 0 })
  })
})

describe('intervalFromInput', () => {
  it.each<[string, number]>([
    ['100', 100],
    ['', 0],
    ['0', 0],
    ['12.7', 12], // a whole number: the decimals are dropped
    ['abc', 0],
    ['-5', -5], // kept as typed; it counts as none (canSaveTask, kindFields)
  ])('%j reads as %d', (raw, expected) => {
    expect(intervalFromInput(raw)).toBe(expected)
  })
})

describe('intervalValue', () => {
  it('shows an interval, and nothing for none', () => {
    expect(intervalValue(100)).toBe('100')
    expect(intervalValue(0)).toBe('')
    expect(intervalValue(-5)).toBe('')
  })
})

describe('canSaveTask', () => {
  it.each<[string, TaskFormValues, boolean]>([
    ['an interval task with both intervals', oilChange, true],
    ['an interval task with an hours interval only', { ...oilChange, monthsInterval: 0 }, true],
    ['an interval task with a months interval only', { ...oilChange, hoursInterval: 0 }, true],
    ['an interval task with no interval', { ...oilChange, hoursInterval: 0, monthsInterval: 0 }, false],
    ['an interval task whose intervals are negative', { ...oilChange, hoursInterval: -1, monthsInterval: -1 }, false],
    ['without a name', { ...oilChange, name: '' }, false],
    ['with a blank name', { ...oilChange, name: '   ' }, false],
    ['an expiry task with a current expiry date', flare, true],
    ['an expiry task without a current expiry date: it is optional', { ...flare, currentExpiryDate: '' }, true],
    ['an expiry task without a name', { ...flare, name: ' ' }, false],
    ['a new task before anything is entered', newTaskForm(), false],
  ])('%s', (_name, form, expected) => {
    expect(canSaveTask(form)).toBe(expected)
  })

  it('counts an hours interval the form hides, on an equipment that does not track hours (#181)', () => {
    // Today's behaviour, pinned: the form passes no equipment, so a task that
    // kept its hours interval after the hour-meter was turned off can save
    // with no months interval. #181 records it.
    expect(canSaveTask({ ...oilChange, monthsInterval: 0 })).toBe(true)
  })
})

describe('kindFields', () => {
  it('an interval task sends the intervals entered', () => {
    expect(kindFields(oilChange)).toEqual({ hoursInterval: 100, monthsInterval: 12 })
  })

  it('an interval task sends no interval for 0, nor for a negative one', () => {
    expect(kindFields({ ...oilChange, hoursInterval: 0, monthsInterval: -3 })).toEqual({ hoursInterval: undefined, monthsInterval: undefined })
  })

  it('an interval task never sends a current expiry date', () => {
    expect(kindFields({ ...oilChange, currentExpiryDate: '2029-03-31' })).not.toHaveProperty('currentExpiryDate')
  })

  it('an expiry task sends its current expiry date as UTC midnight of the day, and no interval', () => {
    expect(kindFields({ ...flare, hoursInterval: 100, monthsInterval: 12 })).toEqual({
      hoursInterval: undefined, monthsInterval: undefined, currentExpiryDate: new Date(Date.UTC(2029, 2, 31)),
    })
  })

  it('an expiry task without a current expiry date sends none', () => {
    expect(kindFields({ ...flare, currentExpiryDate: '' })).toEqual({ hoursInterval: undefined, monthsInterval: undefined, currentExpiryDate: undefined })
  })

  it('sends an hours interval the form hides, on an equipment that does not track hours (#181)', () => {
    // Today's behaviour, pinned: the backend rejects it on such an equipment.
    expect(kindFields({ ...oilChange, monthsInterval: 0 }).hoursInterval).toBe(100)
  })
})

describe('toTaskInput', () => {
  it('sends the equipment, the trimmed name and description, the kind and its fields', () => {
    expect(toTaskInput({ ...oilChange, name: ' Oil change ', description: ' Engine oil ' }, 7)).toEqual({
      equipmentId: 7, name: 'Oil change', description: 'Engine oil', kind: 'interval', hoursInterval: 100, monthsInterval: 12,
    })
  })

  it('sends no description when it is blank', () => {
    expect(toTaskInput({ ...oilChange, description: '  ' }, 7).description).toBeUndefined()
  })

  it('an expiry task sends its kind and current expiry date', () => {
    expect(toTaskInput(flare, 7)).toEqual({
      equipmentId: 7, name: 'Replace flare', description: undefined, kind: 'expiry',
      hoursInterval: undefined, monthsInterval: undefined, currentExpiryDate: new Date(Date.UTC(2029, 2, 31)),
    })
  })
})

describe('saveTask', () => {
  function fakeApi(fail?: Error) {
    const created: Parameters<TaskSaver['createTask']>[0][] = []
    const updated: Parameters<TaskSaver['updateTask']>[0][] = []
    const api: TaskSaver = {
      createTask: async (req) => {
        created.push(req)
        if (fail) throw fail
      },
      updateTask: async (req) => {
        updated.push(req)
        if (fail) throw fail
      },
    }
    return { api, created, updated }
  }

  it('creates the task without a taskId, and resolves to null', async () => {
    const { api, created, updated } = fakeApi()

    expect(await saveTask(oilChange, { equipmentId: 7, taskId: null }, api)).toBeNull()
    expect(created).toEqual([{ taskInput: toTaskInput(oilChange, 7) }])
    expect(updated).toEqual([])
  })

  it('updates the task with a taskId, and resolves to null', async () => {
    const { api, created, updated } = fakeApi()

    expect(await saveTask(flare, { equipmentId: 7, taskId: 12 }, api)).toBeNull()
    expect(updated).toEqual([{ id: 12, taskInput: toTaskInput(flare, 7) }])
    expect(created).toEqual([])
  })

  it('resolves to a fixed message on failure, never the backend reason', async () => {
    const reason = new ResponseError(new Response(JSON.stringify({ error: 'hours_interval requires the equipment to have hour-meter tracking enabled' }), { status: 400 }))

    expect(await saveTask(oilChange, { equipmentId: 7, taskId: null }, fakeApi(reason).api)).toBe('Failed to add task')
    expect(await saveTask(oilChange, { equipmentId: 7, taskId: 12 }, fakeApi(reason).api)).toBe('Failed to update task')
    expect(await saveTask(oilChange, { equipmentId: 7, taskId: 12 }, fakeApi(new Error('network')).api)).toBe('Failed to update task')
  })
})
