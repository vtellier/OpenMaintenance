import { describe, expect, it } from 'vitest'
import { ResponseError } from '@generated/api/runtime'
import { Group } from '@generated/api/models/Group'
import { GroupInput } from '@generated/api/models/GroupInput'
import { canCreateGroup, GroupCreator, newGroupForm, saveNewGroup } from '@/lib/groupForm'

// The Group picker's "+ New group" form (doc/gui/equipments.md, "The Group picker").

describe('newGroupForm', () => {
  it('opens empty, with the default group icon', () => {
    expect(newGroupForm()).toEqual({ name: '', icon: '🗂️' })
  })
})

describe('canCreateGroup', () => {
  it.each<[string, boolean]>([
    ['Winches', true],
    ['  Winches ', true],
    ['', false],
    ['   ', false],
  ])('a name of %j: %j', (name, expected) => {
    expect(canCreateGroup({ name, icon: '🗂️' })).toBe(expected)
  })
})

describe('saveNewGroup', () => {
  function fakeApi(result: Group | Error) {
    const calls: { groupInput: GroupInput }[] = []
    const api: GroupCreator = {
      async createGroup(req) {
        calls.push(req)
        if (result instanceof Error) throw result
        return result
      },
    }
    return { api, calls }
  }

  it('creates the group with its name trimmed and its icon, and resolves to it as a row', async () => {
    const createdAt = new Date('2026-11-27T10:00:00Z')
    const { api, calls } = fakeApi({ id: 9, name: 'Winches', icon: '⚙️', createdAt, updatedAt: createdAt })

    expect(await saveNewGroup({ name: '  Winches ', icon: '⚙️' }, api)).toEqual({
      group: { id: 9, name: 'Winches', icon: '⚙️', createdAt: createdAt.toISOString(), updatedAt: createdAt.toISOString() },
    })
    expect(calls).toEqual([{ groupInput: { name: 'Winches', icon: '⚙️' } }])
  })

  it('resolves to the reason the backend gives', async () => {
    const response = new Response(JSON.stringify({ error: 'A group with this name already exists' }), { status: 409 })
    const { api } = fakeApi(new ResponseError(response))

    expect(await saveNewGroup({ name: 'Winches', icon: '🗂️' }, api)).toEqual({ error: 'A group with this name already exists' })
  })

  it('resolves to a fallback without one', async () => {
    const { api } = fakeApi(new Error('network'))

    expect(await saveNewGroup({ name: 'Winches', icon: '🗂️' }, api)).toEqual({ error: 'Failed to create group' })
  })
})
