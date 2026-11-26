import { describe, expect, it } from 'vitest'
import { ResponseError } from '@generated/api/runtime'
import { EquipmentInput } from '@generated/api/models/EquipmentInput'
import { Task } from '@generated/api/models/Task'
import {
  canAddEquipment, canSaveEdit, decommissioningInvalid, editFormOf, EquipmentEditApi, EquipmentEditValues, hasHoursInterval,
  hoursTooLow, iconChangeInput, newEquipmentForm, NewEquipmentValues, saveEdit, toEquipmentEditInput, toNewEquipmentInput, turningOn,
} from '@/lib/equipmentForm'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

describe('Add equipment', () => {
  const engine: NewEquipmentValues = {
    name: 'Main engine', description: '', icon: '⚙️', groupId: 4, commissionedAt: '2020-05-01', tracksHours: true, hours: 120,
  }

  it('opens empty, with the default icon, no group and no hour-meter', () => {
    expect(newEquipmentForm()).toEqual({
      name: '', description: '', icon: '🔧', groupId: null, commissionedAt: '', tracksHours: false, hours: 0,
    })
  })

  it('requires a name, and nothing else', () => {
    expect(canAddEquipment(engine)).toBe(true)
    expect(canAddEquipment({ ...newEquipmentForm(), name: 'Dinghy' })).toBe(true)
    expect(canAddEquipment({ ...engine, name: '  ' })).toBe(false)
    expect(canAddEquipment(newEquipmentForm())).toBe(false)
  })

  it('sends the trimmed fields, the group, the commissioning date and the initial reading', () => {
    expect(toNewEquipmentInput({ ...engine, name: ' Main engine ', description: ' Yanmar ', icon: ' ⚙️ ' })).toEqual({
      name: 'Main engine', description: 'Yanmar', icon: '⚙️', groupId: 4,
      commissionedAt: utc(2020, 5, 1), tracksHours: true, hours: 120,
    })
  })

  it('sends no description, icon or commissioning date when they are empty, and no group as null', () => {
    expect(toNewEquipmentInput({ ...newEquipmentForm(), name: 'Dinghy', icon: ' ' })).toEqual({
      name: 'Dinghy', description: undefined, icon: undefined, groupId: null,
      commissionedAt: undefined, tracksHours: false, hours: undefined,
    })
  })

  it('sends an initial reading of 0 with the hour-meter on', () => {
    expect(toNewEquipmentInput({ ...engine, hours: 0 }).hours).toBe(0)
  })

  it('sends no reading without the hour-meter, whatever was typed', () => {
    expect(toNewEquipmentInput({ ...engine, tracksHours: false, hours: 50 }).hours).toBeUndefined()
  })
})

// The edit form of an equipment without an hour-meter that kept a reading of
// 80 h from an earlier tracking period.
const offWithReading: EquipmentEditValues = {
  name: 'Main engine', description: '', icon: '🔧', groupId: null, commissionedAt: '', decommissionedAt: '',
  tracksHours: false, originalTracksHours: false, hours: 80, minHours: 80,
}
const turnedOn: EquipmentEditValues = { ...offWithReading, tracksHours: true }
const tracking: EquipmentEditValues = { ...offWithReading, tracksHours: true, originalTracksHours: true }
const today = '2026-11-18'

describe('editFormOf', () => {
  it("opens with the equipment's values", () => {
    expect(editFormOf({
      id: 1, name: 'Main engine', description: 'Yanmar', icon: '⚙️', groupId: 4,
      commissionedAt: '2020-05-01', decommissionedAt: '2026-01-31', tracksHours: true, hours: 120,
    })).toEqual({
      name: 'Main engine', description: 'Yanmar', icon: '⚙️', groupId: 4,
      commissionedAt: '2020-05-01', decommissionedAt: '2026-01-31',
      tracksHours: true, originalTracksHours: true, hours: 120, minHours: 120,
    })
  })

  it('starts an equipment without values at none, the default icon and a reading of 0', () => {
    expect(editFormOf({ id: 1, name: 'Dinghy' })).toEqual({
      name: 'Dinghy', description: '', icon: '🔧', groupId: null, commissionedAt: '', decommissionedAt: '',
      tracksHours: false, originalTracksHours: false, hours: 0, minHours: 0,
    })
  })

  it('shows the default icon for an empty one', () => {
    expect(editFormOf({ id: 1, name: 'Dinghy', icon: '' }).icon).toBe('🔧')
  })

  it('keeps the reading of an earlier tracking period as the floor, the hour-meter off', () => {
    expect(editFormOf({ id: 1, name: 'Main engine', tracksHours: false, hours: 80 })).toMatchObject({
      tracksHours: false, originalTracksHours: false, hours: 80, minHours: 80,
    })
  })
})

describe('turningOn', () => {
  it('is true only when the hour-meter goes from off to on', () => {
    expect(turningOn(turnedOn)).toBe(true)
    expect(turningOn(offWithReading)).toBe(false)
    expect(turningOn(tracking)).toBe(false)
    // Turning it off (#171: no warning) is not turning it on.
    expect(turningOn({ ...tracking, tracksHours: false })).toBe(false)
  })
})

describe('hoursTooLow', () => {
  it.each<[string, EquipmentEditValues, boolean]>([
    ['turning on below the reading kept', { ...turnedOn, hours: 79 }, true],
    ['turning on at the reading kept', turnedOn, false],
    ['turning on above the reading kept', { ...turnedOn, hours: 200 }, false],
    ['turning on with no reading kept, at 0', { ...turnedOn, hours: 0, minHours: 0 }, false],
    ['already tracking: the form has no reading', { ...tracking, hours: 0 }, false],
    ['the hour-meter left off', { ...offWithReading, hours: 0 }, false],
  ])('%s', (_name, form, expected) => {
    expect(hoursTooLow(form)).toBe(expected)
  })
})

describe('decommissioningInvalid', () => {
  it.each<[string, Partial<EquipmentEditValues>, boolean]>([
    ['in service', {}, false],
    ['decommissioned today', { decommissionedAt: today }, false],
    ['decommissioned in the past', { decommissionedAt: '2025-03-01' }, false],
    ['decommissioned after today', { decommissionedAt: '2026-11-19' }, true],
    ['decommissioned the day it was commissioned', { commissionedAt: '2025-03-01', decommissionedAt: '2025-03-01' }, false],
    ['decommissioned before it was commissioned', { commissionedAt: '2025-03-02', decommissionedAt: '2025-03-01' }, true],
  ])('%s', (_name, change, expected) => {
    expect(decommissioningInvalid({ ...offWithReading, ...change }, today)).toBe(expected)
  })
})

describe('canSaveEdit', () => {
  it.each<[string, EquipmentEditValues, boolean]>([
    ['a name and nothing wrong', offWithReading, true],
    ['without a name', { ...offWithReading, name: '' }, false],
    ['with a blank name', { ...offWithReading, name: '  ' }, false],
    ['turning the hour-meter on below the reading kept', { ...turnedOn, hours: 10 }, false],
    ['turning the hour-meter on at the reading kept', turnedOn, true],
    ['a decommissioning date after today', { ...offWithReading, decommissionedAt: '2026-12-01' }, false],
    ['a decommissioning date before the date of commissioning', { ...offWithReading, commissionedAt: '2026-01-02', decommissionedAt: '2026-01-01' }, false],
  ])('%s', (_name, form, expected) => {
    expect(canSaveEdit(form, today)).toBe(expected)
  })
})

describe('toEquipmentEditInput', () => {
  it('sends the trimmed fields, the group and both dates as UTC midnight of the day', () => {
    expect(toEquipmentEditInput({
      ...tracking, name: ' Main engine ', description: ' Yanmar ', icon: ' ⚙️ ', groupId: 4,
      commissionedAt: '2020-05-01', decommissionedAt: '2026-01-31',
    })).toEqual({
      name: 'Main engine', description: 'Yanmar', icon: '⚙️', groupId: 4,
      commissionedAt: utc(2020, 5, 1), decommissionedAt: utc(2026, 1, 31), tracksHours: true, hours: undefined,
    })
  })

  it('sends no decommissioning date when it is empty, which puts the equipment back in service', () => {
    const input = toEquipmentEditInput(offWithReading)
    expect(input).toHaveProperty('decommissionedAt', undefined)
    expect(input).toMatchObject({ description: undefined, commissionedAt: undefined, groupId: null })
  })

  it('sends the reading when turning the hour-meter on, 0 included', () => {
    expect(toEquipmentEditInput({ ...turnedOn, hours: 95 })).toMatchObject({ tracksHours: true, hours: 95 })
    expect(toEquipmentEditInput({ ...turnedOn, hours: 0, minHours: 0 }).hours).toBe(0)
  })

  it('sends no reading when the hour-meter was already on, nor when it stays off', () => {
    expect(toEquipmentEditInput({ ...tracking, hours: 500 }).hours).toBeUndefined()
    expect(toEquipmentEditInput(offWithReading)).toMatchObject({ tracksHours: false, hours: undefined })
  })

  it('turning the hour-meter off sends it off, and no reading', () => {
    expect(toEquipmentEditInput({ ...tracking, tracksHours: false })).toMatchObject({ tracksHours: false, hours: undefined })
  })
})

const oilChange: Task = { id: 10, equipmentId: 1, name: 'Oil change', hoursInterval: 100 }
const antifouling: Task = { id: 11, equipmentId: 1, name: 'Antifouling', monthsInterval: 12 }
const zeroHours: Task = { id: 12, equipmentId: 1, name: 'Grease', hoursInterval: 0, monthsInterval: 6 }

describe('hasHoursInterval', () => {
  it('is true when a task has an hours interval above 0', () => {
    expect(hasHoursInterval([antifouling, oilChange])).toBe(true)
  })

  it('is false when none has, or only of 0', () => {
    expect(hasHoursInterval([antifouling, zeroHours])).toBe(false)
    expect(hasHoursInterval([])).toBe(false)
  })
})

/** A fake of the two APIs the edit form saves through, recording the calls. */
function fakeApi(opts: { tasks?: Task[] | Error, update?: Error } = {}) {
  const calls: { listTasks: number[], updates: { id: number, equipmentInput: EquipmentInput }[] } = { listTasks: [], updates: [] }
  const api: EquipmentEditApi = {
    tasks: {
      listTasksByEquipment: async ({ equipmentId }) => {
        calls.listTasks.push(equipmentId)
        if (opts.tasks instanceof Error) throw opts.tasks
        return opts.tasks ?? []
      },
    },
    equipments: {
      updateEquipment: async (req) => {
        calls.updates.push(req)
        if (opts.update) throw opts.update
      },
    },
  }
  return { api, calls }
}

describe('saveEdit', () => {
  it('saves an edit that leaves the hour-meter as it is, without fetching the tasks', async () => {
    const { api, calls } = fakeApi({ tasks: [oilChange] })

    expect(await saveEdit(tracking, 1, api, false)).toEqual({ saved: true })
    expect(calls.listTasks).toEqual([])
    expect(calls.updates).toEqual([{ id: 1, equipmentInput: toEquipmentEditInput(tracking) }])
  })

  it('turning the hour-meter off saves without asking (#171)', async () => {
    const { api, calls } = fakeApi({ tasks: [oilChange] })

    expect(await saveEdit({ ...tracking, tracksHours: false }, 1, api, false)).toEqual({ saved: true })
    expect(calls.listTasks).toEqual([])
  })

  it('turning the hour-meter on asks first when a task has an hours interval, and saves nothing', async () => {
    const { api, calls } = fakeApi({ tasks: [antifouling, oilChange] })

    expect(await saveEdit(turnedOn, 1, api, false)).toEqual({ needsConfirmation: true })
    expect(calls.listTasks).toEqual([1])
    expect(calls.updates).toEqual([])
  })

  it('turning the hour-meter on, once confirmed, saves without fetching the tasks again', async () => {
    const { api, calls } = fakeApi({ tasks: [oilChange] })

    expect(await saveEdit(turnedOn, 1, api, true)).toEqual({ saved: true })
    expect(calls.listTasks).toEqual([])
    expect(calls.updates).toEqual([{ id: 1, equipmentInput: toEquipmentEditInput(turnedOn) }])
  })

  it('turning the hour-meter on saves straight away when no task has an hours interval', async () => {
    const { api, calls } = fakeApi({ tasks: [antifouling] })

    expect(await saveEdit(turnedOn, 1, api, false)).toEqual({ saved: true })
    expect(calls.listTasks).toEqual([1])
    expect(calls.updates).toHaveLength(1)
  })

  it('turning the hour-meter on saves without asking when the tasks cannot be fetched', async () => {
    const { api, calls } = fakeApi({ tasks: new Error('offline') })

    expect(await saveEdit(turnedOn, 1, api, false)).toEqual({ saved: true })
    expect(calls.updates).toHaveLength(1)
  })

  it('a failed save gives the reason the backend gives', async () => {
    const response = new Response(JSON.stringify({ error: 'Hours cannot be lower than 80' }), { status: 400 })
    const { api } = fakeApi({ update: new ResponseError(response) })

    expect(await saveEdit(turnedOn, 1, api, true)).toEqual({ error: 'Hours cannot be lower than 80' })
  })

  it('a failed save without a reason says it failed', async () => {
    const { api } = fakeApi({ update: new Error('network') })

    expect(await saveEdit(tracking, 1, api, false)).toEqual({ error: 'Failed to save equipment' })
  })
})

describe('iconChangeInput', () => {
  it('sends the icon and every other field back as it stands, and no reading', () => {
    expect(iconChangeInput({
      id: 1, name: 'Main engine', description: 'Yanmar', icon: '🔧', groupId: 4,
      commissionedAt: '2020-05-01', decommissionedAt: '2026-01-31', tracksHours: true, hours: 120,
    }, '⚙️')).toEqual({
      name: 'Main engine', description: 'Yanmar', icon: '⚙️', groupId: 4,
      commissionedAt: utc(2020, 5, 1), decommissionedAt: utc(2026, 1, 31), tracksHours: true,
    })
  })

  it('sends no group as null, and no description or dates when there are none', () => {
    expect(iconChangeInput({ id: 1, name: 'Dinghy', description: '', tracksHours: false }, '⛵')).toEqual({
      name: 'Dinghy', description: undefined, icon: '⛵', groupId: null,
      commissionedAt: undefined, decommissionedAt: undefined, tracksHours: false,
    })
  })

  it('sends the description as it stands, untrimmed', () => {
    expect(iconChangeInput({ id: 1, name: 'Dinghy', description: ' Tender ' }, '⛵').description).toBe(' Tender ')
  })
})
