import { describe, expect, it } from 'vitest'
import {
  COLLAPSED_KEY, isCollapsed, PrefsStorage, readCollapsed, readShowDecommissioned, SHOW_DECOMMISSIONED_KEY,
  toggleCollapsed, writeCollapsed, writeShowDecommissioned,
} from '@/lib/equipmentsListPrefs'

// The Equipments list remembers its collapsed sections and "Show
// decommissioned" per browser (doc/gui/equipments.md).

function fakeStorage(items: Record<string, string> = {}): PrefsStorage & { items: Record<string, string> } {
  return {
    items,
    getItem: key => key in items ? items[key] : null,
    setItem: (key, value) => { items[key] = value },
  }
}

// A browser that refuses access to its storage (private mode, blocked site data).
const refusingStorage: PrefsStorage = {
  getItem: () => { throw new Error('SecurityError') },
  setItem: () => { throw new Error('QuotaExceededError') },
}

describe('collapsed sections', () => {
  it('start all expanded', () => {
    expect(readCollapsed(fakeStorage())).toEqual({})
  })

  it('are kept as the ids of the collapsed groups, and read back', () => {
    const storage = fakeStorage()
    writeCollapsed({ 3: true, 7: false, 12: true }, storage)
    expect(storage.items[COLLAPSED_KEY]).toBe('[3,12]')
    expect(readCollapsed(storage)).toEqual({ 3: true, 12: true })
  })

  it('ignore what is not a group id', () => {
    expect(readCollapsed(fakeStorage({ [COLLAPSED_KEY]: '[3,"7",null,12.5,{}]' }))).toEqual({ 3: true, 12.5: true })
    expect(readCollapsed(fakeStorage({ [COLLAPSED_KEY]: '{"3":true}' }))).toEqual({})
    expect(readCollapsed(fakeStorage({ [COLLAPSED_KEY]: 'null' }))).toEqual({})
  })

  it('start all expanded when the kept value is unreadable or the storage refuses', () => {
    expect(readCollapsed(fakeStorage({ [COLLAPSED_KEY]: 'not json' }))).toEqual({})
    expect(readCollapsed(refusingStorage)).toEqual({})
  })

  it('last for the page only when the storage refuses to keep them', () => {
    expect(() => writeCollapsed({ 3: true }, refusingStorage)).not.toThrow()
  })

  it('toggle one group at a time, a new group starting expanded', () => {
    const collapsed = { 3: true }
    expect(isCollapsed(collapsed, 3)).toBe(true)
    expect(isCollapsed(collapsed, 4)).toBe(false)

    const after = toggleCollapsed(collapsed, 4)
    expect(after).toEqual({ 3: true, 4: true })
    expect(toggleCollapsed(after, 3)).toEqual({ 3: false, 4: true })
    expect(collapsed).toEqual({ 3: true })
  })
})

describe('"Show decommissioned"', () => {
  it('starts unchecked', () => {
    expect(readShowDecommissioned(fakeStorage())).toBe(false)
  })

  it('is kept and read back', () => {
    const storage = fakeStorage()
    writeShowDecommissioned(true, storage)
    expect(storage.items[SHOW_DECOMMISSIONED_KEY]).toBe('true')
    expect(readShowDecommissioned(storage)).toBe(true)
    writeShowDecommissioned(false, storage)
    expect(storage.items[SHOW_DECOMMISSIONED_KEY]).toBe('false')
    expect(readShowDecommissioned(storage)).toBe(false)
  })

  it("is checked only for 'true'", () => {
    expect(readShowDecommissioned(fakeStorage({ [SHOW_DECOMMISSIONED_KEY]: 'TRUE' }))).toBe(false)
    expect(readShowDecommissioned(fakeStorage({ [SHOW_DECOMMISSIONED_KEY]: '1' }))).toBe(false)
  })

  it('starts unchecked, and lasts for the page only, when the storage refuses', () => {
    expect(readShowDecommissioned(refusingStorage)).toBe(false)
    expect(() => writeShowDecommissioned(true, refusingStorage)).not.toThrow()
  })
})
