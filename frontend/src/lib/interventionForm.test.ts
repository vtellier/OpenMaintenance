import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResponseError } from '@generated/api/runtime'
import { canSave, InterventionFormValues, isExpiryTask, prefill, save, selectEquipment, toRequest } from '@/lib/interventionForm'

const engine = { id: 1, name: 'Engine', tracksHours: true, hours: 120 }
const trailer = { id: 2, name: 'Trailer', tracksHours: false }
const oilChange = { id: 10, name: 'Oil change', equipmentId: 1 }
const greaseHubs = { id: 11, name: 'Grease hubs', equipmentId: 2 }
// An expiry task: each part fitted carries its own expiry date (#99).
const co2Cartridge = { id: 12, name: 'Replace CO2 cartridge', equipmentId: 2, kind: 'expiry' as const }
const newGenerator = { id: 3, name: 'Generator', tracksHours: true } // tracks hours, no reading yet
const generatorService = { id: 13, name: 'Generator service', equipmentId: 3 }
const ctx = { equipments: [engine, trailer, newGenerator], tasks: [oilChange, greaseHubs, co2Cartridge, generatorService] }

describe('prefill', () => {
  it('editing a standard intervention keeps its equipment and values', () => {
    const form = prefill({
      edit: {
        id: 7, taskId: 10, equipmentId: 1, date: '2026-05-03', hoursAt: 110,
        location: 'Marina', performedBy: 'Self', comments: 'ok',
      },
    }, ctx)

    expect(form).toMatchObject({
      editId: 7, equipmentId: 1, taskId: 10, isExceptional: false, exceptionalLabel: '',
      date: '2026-05-03', hours: 110, location: 'Marina', performedBy: 'Self', comments: 'ok',
    })
  })

  it('editing a standard intervention takes the equipment from its task when the intervention has none', () => {
    const form = prefill({ edit: { id: 7, taskId: 10, date: '2026-05-03' } }, ctx)

    expect(form.equipmentId).toBe(1)
  })

  it("editing an intervention on an expiry task keeps the part's expiry date", () => {
    const form = prefill({ edit: { id: 8, taskId: 12, equipmentId: 2, date: '2026-05-03', expiryDate: '2031-04-30' } }, ctx)

    expect(form.expiryDate).toBe('2031-04-30')
  })

  it('editing an intervention on an interval task has no expiry date', () => {
    expect(prefill({ edit: { id: 7, taskId: 10, equipmentId: 1, date: '2026-05-03' } }, ctx).expiryDate).toBe('')
  })

  it('editing an intervention logged without a reading leaves the reading empty', () => {
    const form = prefill({ edit: { id: 7, taskId: 10, equipmentId: 1, date: '2026-05-03' } }, ctx)

    expect(form.hours).toBeNull()
  })

  describe('a new log', () => {
    afterEach(() => { vi.useRealTimers() })

    it('from an equipment defaults to today and its current reading', () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-06-22T12:00:00')) // local noon

      const form = prefill({ new: { equipmentId: 1 } }, ctx)

      expect(form).toEqual({
        editId: null, equipmentId: 1, taskId: null, isExceptional: false, exceptionalLabel: '',
        date: '2026-06-22', hours: 120, expiryDate: '', location: '', performedBy: '', comments: '',
      })
    })

    it('on an equipment that does not track hours has no reading', () => {
      expect(prefill({ new: { equipmentId: 2 } }, ctx).hours).toBeNull()
    })

    it("quick log for a task defaults to today and its equipment's current reading", () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-06-22T12:00:00')) // local noon

      const form = prefill({ quickLog: { taskId: 10 } }, ctx)

      expect(form).toEqual({
        editId: null, equipmentId: 1, taskId: 10, isExceptional: false, exceptionalLabel: '',
        date: '2026-06-22', hours: 120, expiryDate: '', location: '', performedBy: '', comments: '',
      })
    })

    it('quick log for a task on an equipment that does not track hours has no reading', () => {
      expect(prefill({ quickLog: { taskId: 11 } }, ctx)).toMatchObject({ equipmentId: 2, taskId: 11, hours: null })
    })

    it('quick log for an expiry task starts with no expiry date', () => {
      expect(prefill({ quickLog: { taskId: 12 } }, ctx)).toMatchObject({ equipmentId: 2, taskId: 12, expiryDate: '' })
    })

    it('from an equipment that tracks hours but has no reading yet leaves the reading empty', () => {
      expect(prefill({ new: { equipmentId: 3 } }, ctx).hours).toBeNull()
    })

    it('quick log for a task on an equipment with no reading yet leaves the reading empty', () => {
      expect(prefill({ quickLog: { taskId: 13 } }, ctx)).toMatchObject({ equipmentId: 3, taskId: 13, hours: null })
    })
  })
})

const standard: InterventionFormValues = {
  editId: null, equipmentId: 1, taskId: 10, isExceptional: false, exceptionalLabel: '',
  date: '2026-05-03', hours: 120, expiryDate: '', location: '', performedBy: '', comments: '',
}
const expiry: InterventionFormValues = {
  ...standard, equipmentId: 2, taskId: 12, hours: null, expiryDate: '2031-04-30',
}
const exceptional: InterventionFormValues = {
  ...standard, taskId: null, isExceptional: true, exceptionalLabel: 'Replaced impeller',
}

describe('canSave', () => {
  it.each<[string, InterventionFormValues, boolean]>([
    ['a standard intervention with a task and a date', standard, true],
    ['without a date', { ...standard, date: '' }, false],
    ['a standard intervention without a task', { ...standard, taskId: null }, false],
    ['an exceptional intervention with a label', exceptional, true],
    ['an exceptional intervention without a label', { ...exceptional, exceptionalLabel: '  ' }, false],
    ['an exceptional intervention without an equipment', { ...exceptional, equipmentId: null }, false],
    ['an intervention on an expiry task with an expiry date', expiry, true],
    ['an intervention on an expiry task without an expiry date', { ...expiry, expiryDate: '' }, false],
    ['an intervention on an expiry task with an expiry date already past', { ...expiry, expiryDate: '2020-01-01' }, true],
    ['a quick log for an expiry task before the expiry date is entered', prefill({ quickLog: { taskId: 12 } }, ctx), false],
  ])('%s', (_name, form, expected) => {
    expect(canSave(form, ctx)).toBe(expected)
  })
})

describe('isExpiryTask', () => {
  it('is true for a standard intervention on an expiry task only', () => {
    expect(isExpiryTask(expiry, ctx)).toBe(true)
    expect(isExpiryTask(standard, ctx)).toBe(false)
    expect(isExpiryTask({ ...expiry, taskId: null }, ctx)).toBe(false)
    expect(isExpiryTask({ ...expiry, isExceptional: true }, ctx)).toBe(false)
  })
})

describe('toRequest', () => {
  const may3 = new Date(2026, 4, 3) // local midnight

  it('a standard intervention sends its task, the reading and the trimmed details', () => {
    const req = toRequest({ ...standard, location: ' Marina ', performedBy: ' Self ', comments: '  ' }, ctx)

    expect(req).toEqual({
      id: undefined,
      interventionInput: {
        taskId: 10, date: may3, hoursAt: 120,
        location: 'Marina', performedBy: 'Self', comments: undefined,
      },
    })
  })

  it('sends a reading of 0 when the equipment tracks hours', () => {
    expect(toRequest({ ...standard, hours: 0 }, ctx).interventionInput.hoursAt).toBe(0)
  })

  it('sends no reading when the field is empty', () => {
    expect(toRequest({ ...standard, hours: null }, ctx).interventionInput.hoursAt).toBeUndefined()
  })

  it('sends no reading when the equipment does not track hours', () => {
    expect(toRequest({ ...standard, equipmentId: 2, hours: 50 }, ctx).interventionInput.hoursAt).toBeUndefined()
  })

  it('an exceptional intervention sends its equipment and label instead of a task', () => {
    const req = toRequest({ ...exceptional, exceptionalLabel: ' Replaced impeller ' }, ctx)

    expect(req.interventionInput).toEqual({
      equipmentId: 1, exceptionalLabel: 'Replaced impeller', date: may3, hoursAt: 120,
      location: undefined, performedBy: undefined, comments: undefined,
    })
  })

  it('a quick log sends its task, the date, the reading and the details entered', () => {
    const form = { ...prefill({ quickLog: { taskId: 10 } }, ctx), date: '2026-05-03' as const, performedBy: ' Self ', comments: 'ok' }

    expect(toRequest(form, ctx)).toEqual({
      id: undefined,
      interventionInput: {
        taskId: 10, date: may3, hoursAt: 120,
        location: undefined, performedBy: 'Self', comments: 'ok',
      },
    })
  })

  it('a new log on an equipment with no reading yet, saved untouched, sends no reading', () => {
    const form = { ...prefill({ new: { equipmentId: 3 } }, ctx), taskId: 13 }

    expect(toRequest(form, ctx).interventionInput.hoursAt).toBeUndefined()
  })

  it('a quick log on an equipment with no reading yet, saved untouched, sends no reading', () => {
    const form = prefill({ quickLog: { taskId: 13 } }, ctx)

    expect(toRequest(form, ctx).interventionInput.hoursAt).toBeUndefined()
  })

  it('a quick log with its reading cleared sends no reading', () => {
    const form = { ...prefill({ quickLog: { taskId: 10 } }, ctx), hours: null }

    expect(toRequest(form, ctx).interventionInput.hoursAt).toBeUndefined()
  })

  it('an intervention on an expiry task sends the expiry date as a calendar date', () => {
    expect(toRequest(expiry, ctx).interventionInput).toEqual({
      taskId: 12, date: may3, hoursAt: undefined, expiryDate: new Date('2031-04-30T00:00:00Z'),
      location: undefined, performedBy: undefined, comments: undefined,
    })
  })

  it('a quick log for an expiry task sends the expiry date entered', () => {
    const form = { ...prefill({ quickLog: { taskId: 12 } }, ctx), expiryDate: '2031-04-30' as const }

    expect(toRequest(form, ctx).interventionInput).toMatchObject({ taskId: 12, expiryDate: new Date('2031-04-30T00:00:00Z') })
  })

  it('sends no expiry date for an interval task, even one left from another task', () => {
    expect(toRequest({ ...standard, expiryDate: '2031-04-30' }, ctx).interventionInput.expiryDate).toBeUndefined()
  })

  it('sends no expiry date for an exceptional intervention', () => {
    expect(toRequest({ ...exceptional, expiryDate: '2031-04-30' }, ctx).interventionInput.expiryDate).toBeUndefined()
  })

  it('an edit targets the intervention being edited', () => {
    expect(toRequest({ ...standard, editId: 7 }, ctx).id).toBe(7)
  })
})

describe('save', () => {
  function fakeApi(fail?: Response) {
    const calls: unknown[] = []
    const answer = async (req: unknown) => {
      calls.push(req)
      if (fail) throw new ResponseError(fail)
      return {}
    }
    return { calls, api: { createIntervention: answer, updateIntervention: answer } }
  }

  it('logs a new intervention', async () => {
    const { api, calls } = fakeApi()

    expect(await save(standard, ctx, api)).toBeNull()
    expect(calls).toEqual([{ interventionInput: toRequest(standard, ctx).interventionInput }])
  })

  it('updates the intervention being edited', async () => {
    const { api, calls } = fakeApi()
    const edit = { ...standard, editId: 7 }

    expect(await save(edit, ctx, api)).toBeNull()
    expect(calls).toEqual([{ id: 7, interventionInput: toRequest(edit, ctx).interventionInput }])
  })

  it("returns the backend's reason when the save is refused", async () => {
    const { api } = fakeApi(new Response(JSON.stringify({ error: 'intervention date cannot be in the future' }), { status: 400 }))

    expect(await save(standard, ctx, api)).toBe('intervention date cannot be in the future')
  })

  it('returns a generic reason when the backend gives none', async () => {
    const { api } = fakeApi(new Response('oops', { status: 500 }))

    expect(await save(standard, ctx, api)).toBe('Failed to save intervention')
  })
})

describe('selectEquipment', () => {
  it("clears the task and prefills the new equipment's current reading", () => {
    const form = prefill({ new: { equipmentId: null } }, ctx)
    form.taskId = 10

    selectEquipment(form, 1, ctx)

    expect(form).toMatchObject({ equipmentId: 1, taskId: null, hours: 120 })
  })

  it('clears the reading for an equipment that does not track hours', () => {
    const form = prefill({ new: { equipmentId: 1 } }, ctx)

    selectEquipment(form, 2, ctx)

    expect(form).toMatchObject({ equipmentId: 2, hours: null })
  })

  it('leaves the reading empty for an equipment that tracks hours but has no reading yet', () => {
    const form = prefill({ new: { equipmentId: 1 } }, ctx)

    selectEquipment(form, 3, ctx)

    expect(form).toMatchObject({ equipmentId: 3, hours: null })
    expect(toRequest({ ...form, taskId: 13 }, ctx).interventionInput.hoursAt).toBeUndefined()
  })
})
