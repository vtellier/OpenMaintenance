import { describe, expect, it } from 'vitest'
import { ResponseError } from '@generated/api/runtime'
import {
  canCorrect, canUpdateHours, currentReadingText, HoursCorrector, hoursFromInput, HoursUpdater, hoursUpdateFormOf, prefilledReading, readingFromInput,
  saveCorrection, saveHoursUpdate,
} from '@/lib/hoursForm'

const backendError = (message: string) => new ResponseError(new Response(JSON.stringify({ error: message }), { status: 400 }))

describe('Correct reading', () => {
  describe('prefilledReading', () => {
    it.each<[string, number | null]>([
      ['?hours=118', 118],
      ['?hours=118.5', 118.5],
      ['?hours=0', 0],
      ['?from=history&hours=42', 42],
      ['', null], // opened from the detail header: the field starts empty
      ['?hours=', null],
      ['?hours=abc', null],
      ['?hours=Infinity', null],
      // Kept as given: Correct reading then stays disabled (canCorrect).
      ['?hours=-5', -5],
      // Number(' ') is 0: a '+' (a space) prefills 0.
      ['?hours=+', 0],
    ])('%j prefills %j', (search, expected) => {
      expect(prefilledReading(search)).toBe(expected)
    })
  })

  describe('currentReadingText', () => {
    it('shows the reading in hours, and says when there is none', () => {
      expect(currentReadingText(512)).toBe('512 h')
      expect(currentReadingText(0)).toBe('0 h')
      expect(currentReadingText(null)).toBe('No reading')
      expect(currentReadingText(undefined)).toBe('No reading')
    })
  })

  describe('readingFromInput', () => {
    it('reads the number typed, and an empty field as none', () => {
      expect(readingFromInput('118')).toBe(118)
      expect(readingFromInput('0')).toBe(0)
      expect(readingFromInput('')).toBeNull()
    })
  })

  describe('canCorrect', () => {
    it.each<[number | null, boolean]>([
      [118, true],
      [0, true], // lower than the current reading is the point
      [null, false], // the field is empty
      [-1, false],
      [NaN, false],
    ])('%j: %j', (hours, expected) => {
      expect(canCorrect(hours)).toBe(expected)
    })
  })

  describe('saveCorrection', () => {
    function fakeApi(fail?: Error) {
      const calls: Parameters<HoursCorrector['correctEquipmentHours']>[0][] = []
      const api: HoursCorrector = {
        correctEquipmentHours: async (req) => {
          calls.push(req)
          if (fail) throw fail
        },
      }
      return { api, calls }
    }

    it('sends the corrected reading, and resolves to null', async () => {
      const { api, calls } = fakeApi()

      expect(await saveCorrection(95, 3, api)).toBeNull()
      expect(calls).toEqual([{ id: 3, equipmentHoursCorrectionInput: { hours: 95 } }])
    })

    it('resolves to the reason the backend gives', async () => {
      const { api } = fakeApi(backendError('Hours cannot be negative'))

      expect(await saveCorrection(95, 3, api)).toBe('Hours cannot be negative')
    })

    it('resolves to a fallback without one', async () => {
      const { api } = fakeApi(new Error('network'))

      expect(await saveCorrection(95, 3, api)).toBe('Failed to correct the reading')
    })
  })
})

describe('Update hours', () => {
  describe('hoursUpdateFormOf', () => {
    it('opens at the current reading', () => {
      expect(hoursUpdateFormOf({ hours: 120 })).toEqual({ currentHours: 120, newHours: 120 })
    })

    it('opens at 0 when there is no reading yet', () => {
      expect(hoursUpdateFormOf({})).toEqual({ currentHours: 0, newHours: 0 })
    })
  })

  describe('hoursFromInput', () => {
    it('reads the number typed, and an empty field as 0', () => {
      expect(hoursFromInput('125.5')).toBe(125.5)
      expect(hoursFromInput('')).toBe(0)
    })
  })

  describe('canUpdateHours', () => {
    it.each<[number, number, boolean]>([
      [120, 130, true],
      [120, 120, true], // the same reading confirms it
      [120, 119, false], // lowering it goes through Correct reading
      [0, 0, true],
    ])('from %d to %d: %j', (currentHours, newHours, expected) => {
      expect(canUpdateHours({ currentHours, newHours })).toBe(expected)
    })

    it('an emptied field reads as 0, so it saves only when there is no reading above 0', () => {
      expect(canUpdateHours({ currentHours: 0, newHours: hoursFromInput('') })).toBe(true)
      expect(canUpdateHours({ currentHours: 120, newHours: hoursFromInput('') })).toBe(false)
    })
  })

  describe('saveHoursUpdate', () => {
    function fakeApi(fail?: Error) {
      const calls: Parameters<HoursUpdater['updateEquipmentHours']>[0][] = []
      const api: HoursUpdater = {
        updateEquipmentHours: async (req) => {
          calls.push(req)
          if (fail) throw fail
        },
      }
      return { api, calls }
    }

    it('sends the new reading, and resolves to null', async () => {
      const { api, calls } = fakeApi()

      expect(await saveHoursUpdate({ currentHours: 120, newHours: 130 }, 3, api)).toBeNull()
      expect(calls).toEqual([{ id: 3, equipmentHoursInput: { hours: 130 } }])
    })

    it('sends the same reading, which confirms it', async () => {
      const { api, calls } = fakeApi()

      await saveHoursUpdate({ currentHours: 120, newHours: 120 }, 3, api)
      expect(calls).toEqual([{ id: 3, equipmentHoursInput: { hours: 120 } }])
    })

    it('resolves to the reason the backend gives', async () => {
      const { api } = fakeApi(backendError('Hours cannot be lower than the current reading'))

      expect(await saveHoursUpdate({ currentHours: 120, newHours: 130 }, 3, api)).toBe('Hours cannot be lower than the current reading')
    })

    it('resolves to a fallback without one', async () => {
      const { api } = fakeApi(new Error('network'))

      expect(await saveHoursUpdate({ currentHours: 120, newHours: 130 }, 3, api)).toBe('Failed to update hours')
    })
  })
})
