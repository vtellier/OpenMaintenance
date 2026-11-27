import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResponseError } from '@generated/api/runtime'
import {
  canSave, deleteIntervention, doubtLeftByEdit, equipmentChoices, formTitle, InterventionDeleter, InterventionFormValues, isExpiryTask, prefill, save,
  selectEquipment, showsHours, taskChoices, toRequest, withExceptional,
} from '@/lib/interventionForm'

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

    it("Done on a task selects its equipment and the task, and defaults to today and the equipment's current reading", () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-06-22T12:00:00')) // local noon

      const form = prefill({ done: { taskId: 10 } }, ctx)

      expect(form).toEqual({
        editId: null, equipmentId: 1, taskId: 10, isExceptional: false, exceptionalLabel: '',
        date: '2026-06-22', hours: 120, expiryDate: '', location: '', performedBy: '', comments: '',
      })
    })

    it('Done on a task of an equipment that does not track hours has no reading', () => {
      expect(prefill({ done: { taskId: 11 } }, ctx)).toMatchObject({ equipmentId: 2, taskId: 11, hours: null })
    })

    it('Done on an expiry task starts with no expiry date', () => {
      expect(prefill({ done: { taskId: 12 } }, ctx)).toMatchObject({ equipmentId: 2, taskId: 12, expiryDate: '' })
    })

    it('from an equipment that tracks hours but has no reading yet leaves the reading empty', () => {
      expect(prefill({ new: { equipmentId: 3 } }, ctx).hours).toBeNull()
    })

    it('Done on a task of an equipment with no reading yet leaves the reading empty, never invented', () => {
      expect(prefill({ done: { taskId: 13 } }, ctx)).toMatchObject({ equipmentId: 3, taskId: 13, hours: null })
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
    ['Done on an expiry task before the expiry date is entered', prefill({ done: { taskId: 12 } }, ctx), false],
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

  it('a task marked done sends its task, the date, the reading and the details entered', () => {
    const form = { ...prefill({ done: { taskId: 10 } }, ctx), date: '2026-05-03' as const, performedBy: ' Self ', comments: 'ok' }

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

  it('a task marked done on an equipment with no reading yet, saved untouched, sends no reading', () => {
    const form = prefill({ done: { taskId: 13 } }, ctx)

    expect(toRequest(form, ctx).interventionInput.hoursAt).toBeUndefined()
  })

  it('a task marked done with its reading cleared sends no reading', () => {
    const form = { ...prefill({ done: { taskId: 10 } }, ctx), hours: null }

    expect(toRequest(form, ctx).interventionInput.hoursAt).toBeUndefined()
  })

  it('an intervention on an expiry task sends the expiry date as a calendar date', () => {
    expect(toRequest(expiry, ctx).interventionInput).toEqual({
      taskId: 12, date: may3, hoursAt: undefined, expiryDate: new Date('2031-04-30T00:00:00Z'),
      location: undefined, performedBy: undefined, comments: undefined,
    })
  })

  it('an expiry task marked done sends the expiry date entered', () => {
    const form = { ...prefill({ done: { taskId: 12 } }, ctx), expiryDate: '2031-04-30' as const }

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

// Issue #113: the equipment picker still offers decommissioned equipments, so
// past work on them can be logged, marked and after the ones in service
// (doc/gui/interventions.md, "Fields").
describe('equipmentChoices', () => {
  it('lists the equipments in service first, then the decommissioned ones, marked', () => {
    expect(equipmentChoices([
      { id: 1, name: 'Old dinghy', decommissionedAt: '2024-09-30' },
      { id: 2, name: 'Main engine' },
      { id: 3, name: 'Bow thruster', decommissionedAt: '2025-03-01' },
      { id: 4, name: 'Anchor windlass', decommissionedAt: '' },
    ])).toEqual([
      { id: 2, label: 'Main engine' },
      { id: 4, label: 'Anchor windlass' },
      { id: 1, label: 'Old dinghy (decommissioned)' },
      { id: 3, label: 'Bow thruster (decommissioned)' },
    ])
  })
})

describe('formTitle', () => {
  it('reads "Edit intervention" for an intervention being edited, "Log intervention" otherwise', () => {
    expect(formTitle({ editId: 7 })).toBe('Edit intervention')
    expect(formTitle({ editId: null })).toBe('Log intervention')
  })
})

describe('taskChoices', () => {
  it("offers the tasks of the equipment picked, in the order given", () => {
    expect(taskChoices({ equipmentId: 2 }, ctx.tasks)).toEqual([greaseHubs, co2Cartridge])
  })

  it('offers none until an equipment is picked', () => {
    expect(taskChoices({ equipmentId: null }, ctx.tasks)).toEqual([])
  })
})

describe('showsHours', () => {
  it('asks for a reading when the equipment picked tracks hours, with or without one yet', () => {
    expect(showsHours({ equipmentId: 1 }, ctx)).toBe(true)
    expect(showsHours({ equipmentId: 3 }, ctx)).toBe(true)
  })

  it('does not for an equipment without an hour-meter, an unknown one, or none', () => {
    expect(showsHours({ equipmentId: 2 }, ctx)).toBe(false)
    expect(showsHours({ equipmentId: 99 }, ctx)).toBe(false)
    expect(showsHours({ equipmentId: null }, ctx)).toBe(false)
  })
})

describe('withExceptional', () => {
  it('checking the switch clears the task and keeps the label', () => {
    const form = { ...prefill({ done: { taskId: 10 } }, ctx), exceptionalLabel: 'Kept' }

    expect(withExceptional(form, true)).toMatchObject({ isExceptional: true, taskId: null, exceptionalLabel: 'Kept' })
    expect(form).toMatchObject({ isExceptional: false, taskId: 10 })
  })

  it('unchecking it clears the label and keeps the task', () => {
    const form = { ...prefill({ new: { equipmentId: 1 } }, ctx), isExceptional: true, exceptionalLabel: 'Replaced impeller', taskId: 10 }

    expect(withExceptional(form, false)).toMatchObject({ isExceptional: false, exceptionalLabel: '', taskId: 10 })
  })
})

// The reading the edit or the delete may leave in doubt (doc/gui/interventions.md,
// "Reading in doubt"); readingDoubt.test.ts covers the rule itself.
describe('doubtLeftByEdit', () => {
  const logged = { id: 7, taskId: 10, equipmentId: 1, date: '2026-05-03', hoursAt: 120 }
  const doubtCtx = { ...ctx, interventions: [logged] }

  it('an edit that lowers the reading the equipment has leaves it in doubt', () => {
    const source = { edit: logged }
    const form = { ...prefill(source, ctx), hours: 100 }

    expect(doubtLeftByEdit(source, form, doubtCtx)).toEqual({ equipmentId: 1, equipmentName: 'Engine', reading: 120, suggested: 100 })
  })

  it('an edit that keeps the reading leaves no doubt', () => {
    const source = { edit: logged }

    expect(doubtLeftByEdit(source, prefill(source, ctx), doubtCtx)).toBeNull()
  })

  it('a new log never does', () => {
    const source = { new: { equipmentId: 1 } }

    expect(doubtLeftByEdit(source, { ...prefill(source, ctx), hours: 0, taskId: 10 }, doubtCtx)).toBeNull()
  })
})

describe('deleteIntervention', () => {
  function fakeApi(failure?: Error) {
    const calls: { id: number }[] = []
    const api: InterventionDeleter = {
      async deleteIntervention(req) {
        calls.push(req)
        if (failure) throw failure
      },
    }
    return { api, calls }
  }
  const logged = { id: 7, taskId: 10, equipmentId: 1, hoursAt: 120 }
  const doubtCtx = { ...ctx, interventions: [logged] }

  it('deletes the intervention, and resolves to the doubt it leaves on the reading, from the data before the delete', async () => {
    const { api, calls } = fakeApi()

    expect(await deleteIntervention(logged, doubtCtx, api)).toEqual({
      doubt: { equipmentId: 1, equipmentName: 'Engine', reading: 120, suggested: null },
    })
    expect(calls).toEqual([{ id: 7 }])
  })

  it('resolves to no doubt when the intervention did not record the current reading', async () => {
    const { api } = fakeApi()

    expect(await deleteIntervention({ ...logged, hoursAt: 100 }, doubtCtx, api)).toEqual({ doubt: null })
  })

  it('resolves to "Failed to delete intervention", whatever the backend says', async () => {
    const response = new Response(JSON.stringify({ error: 'database is locked' }), { status: 500 })
    const { api } = fakeApi(new ResponseError(response))

    expect(await deleteIntervention(logged, doubtCtx, api)).toEqual({ error: 'Failed to delete intervention' })
  })
})
