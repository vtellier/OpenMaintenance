import { describe, expect, it } from 'vitest'
import { correctReadingHref, readingDoubt } from '@/lib/readingDoubt'

// Issue #70: deleting an intervention, or editing its reading down, never
// lowers the equipment's reading by itself. When the reading may have come
// from that intervention, the user is asked to keep or correct it, and the
// correction is prefilled with the highest reading left.

const engine = { id: 1, name: 'Main Engine', tracksHours: true, hours: 500 }
const generator = { id: 2, name: 'Generator', tracksHours: true, hours: 80 }
const trailer = { id: 3, name: 'Trailer', tracksHours: false, hours: 500 }
const unread = { id: 4, name: 'New pump', tracksHours: true } // tracks hours, no reading yet
const oilChange = { id: 10, equipmentId: 1 }
const impeller = { id: 11, equipmentId: 1 }
const greaseHubs = { id: 12, equipmentId: 3 }

const at300 = { id: 100, taskId: 10, equipmentId: 1, hoursAt: 300 }
const at500 = { id: 101, taskId: 11, equipmentId: 1, hoursAt: 500 }
const noReading = { id: 102, taskId: 10, equipmentId: 1 }
const exceptionalAt420 = { id: 103, equipmentId: 1, hoursAt: 420 }
const onGenerator = { id: 104, equipmentId: 2, hoursAt: 900 }
const trailerAt500 = { id: 105, taskId: 12, equipmentId: 3, hoursAt: 500 }

const ctx = {
  equipments: [engine, generator, trailer, unread],
  tasks: [oilChange, impeller, greaseHubs],
  interventions: [at300, at500, noReading, exceptionalAt420, onGenerator, trailerAt500],
}

describe('readingDoubt after a delete', () => {
  it('asks when the deleted intervention recorded the current reading, prefilled with the highest reading left', () => {
    expect(readingDoubt({ deleted: at500 }, ctx)).toEqual({
      equipmentId: 1, equipmentName: 'Main Engine', reading: 500, suggested: 420,
    })
  })

  it('prefills nothing when no other intervention of the equipment has a reading', () => {
    const only = { ...ctx, interventions: [at500, noReading, onGenerator] }

    expect(readingDoubt({ deleted: at500 }, only)?.suggested).toBeNull()
  })

  it('does not ask when the current reading is higher than the deleted one', () => {
    expect(readingDoubt({ deleted: at300 }, ctx)).toBeNull()
  })

  it('does not ask for an intervention without a reading', () => {
    expect(readingDoubt({ deleted: noReading }, ctx)).toBeNull()
  })

  it('does not ask on an equipment that does not track hours', () => {
    expect(readingDoubt({ deleted: trailerAt500 }, ctx)).toBeNull()
  })

  it('does not ask on an equipment with no reading', () => {
    const pumpAt0 = { id: 106, equipmentId: 4, hoursAt: 0 }

    expect(readingDoubt({ deleted: pumpAt0 }, { ...ctx, interventions: [pumpAt0] })).toBeNull()
  })

  it('takes the equipment from the task when the intervention has none', () => {
    const fromTask = { id: 107, taskId: 11, hoursAt: 500 }

    expect(readingDoubt({ deleted: fromTask }, { ...ctx, interventions: [at300, fromTask] })).toMatchObject({
      equipmentId: 1, suggested: 300,
    })
  })
})

describe('readingDoubt after an edit', () => {
  it('asks when the reading is lowered, prefilled with the highest reading left, the edited one included', () => {
    expect(readingDoubt({ edited: at500, to: { equipmentId: 1, hoursAt: 450 } }, ctx)).toEqual({
      equipmentId: 1, equipmentName: 'Main Engine', reading: 500, suggested: 450,
    })
  })

  it('prefills the highest other reading when it is above the edited one', () => {
    expect(readingDoubt({ edited: at500, to: { equipmentId: 1, hoursAt: 50 } }, ctx)?.suggested).toBe(420)
  })

  it('asks when the reading is cleared', () => {
    expect(readingDoubt({ edited: at500, to: { equipmentId: 1, hoursAt: undefined } }, ctx)?.suggested).toBe(420)
  })

  it('asks for the old equipment when the intervention moves to another one', () => {
    expect(readingDoubt({ edited: at500, to: { equipmentId: 2, hoursAt: 500 } }, ctx)).toMatchObject({
      equipmentId: 1, suggested: 420,
    })
  })

  it('does not ask when the reading is kept', () => {
    expect(readingDoubt({ edited: at500, to: { equipmentId: 1, hoursAt: 500 } }, ctx)).toBeNull()
  })

  it('does not ask when the reading is raised', () => {
    expect(readingDoubt({ edited: at500, to: { equipmentId: 1, hoursAt: 520 } }, ctx)).toBeNull()
  })

  it('does not ask when the edited intervention did not record the current reading', () => {
    expect(readingDoubt({ edited: at300, to: { equipmentId: 1, hoursAt: 100 } }, ctx)).toBeNull()
  })
})

describe('correctReadingHref', () => {
  it('opens Correct reading prefilled with the suggested reading', () => {
    expect(correctReadingHref({ equipmentId: 1, equipmentName: 'Main Engine', reading: 500, suggested: 420 }))
      .toBe('/equipments/1/edit/hours/correct?hours=420')
  })

  it('opens it empty when there is nothing to suggest', () => {
    expect(correctReadingHref({ equipmentId: 1, equipmentName: 'Main Engine', reading: 500, suggested: null }))
      .toBe('/equipments/1/edit/hours/correct')
  })
})
