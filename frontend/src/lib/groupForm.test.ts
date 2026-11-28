import { describe, expect, it } from 'vitest'
import { ResponseError } from '@generated/api/runtime'
import { Group } from '@generated/api/models/Group'
import { GroupInput } from '@generated/api/models/GroupInput'
import {
  canCreateGroup, canRenameGroup, changeGroupIcon, deleteGroup, deleteGroupText, GroupCreator, GroupDeleter, GroupUpdater, iconUnchanged, newGroupForm, renameGroup,
  saveNewGroup,
} from '@/lib/groupForm'

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

describe('canRenameGroup', () => {
  it.each<[string, boolean]>([
    ['Winches', true],
    [' Winches ', true],
    ['', false],
    ['  ', false],
  ])('a name of %j: %j', (name, expected) => {
    expect(canRenameGroup(name)).toBe(expected)
  })
})

function fakeUpdater(failure?: Error) {
  const calls: { id: number, groupInput: GroupInput }[] = []
  const api: GroupUpdater = {
    async updateGroup(req) {
      calls.push(req)
      if (failure) throw failure
    },
  }
  return { api, calls }
}

const refused = (error: string, status: number) => new ResponseError(new Response(JSON.stringify({ error }), { status }))

describe('renameGroup', () => {
  it('saves the name trimmed, with the icon the group has, and resolves to null', async () => {
    const { api, calls } = fakeUpdater()

    expect(await renameGroup({ id: 3, icon: '⚙️' }, '  Deck winches ', api)).toBeNull()
    expect(calls).toEqual([{ id: 3, groupInput: { name: 'Deck winches', icon: '⚙️' } }])
  })

  it('resolves to the reason the backend gives', async () => {
    const { api } = fakeUpdater(refused('A group with this name already exists', 409))

    expect(await renameGroup({ id: 3 }, 'Sails', api)).toBe('A group with this name already exists')
  })

  it('resolves to a fallback without one', async () => {
    const { api } = fakeUpdater(new Error('network'))

    expect(await renameGroup({ id: 3 }, 'Sails', api)).toBe('Failed to rename group')
  })
})

describe('iconUnchanged', () => {
  it('the icon the group has leaves nothing to save; another one does', () => {
    expect(iconUnchanged({ id: 3, icon: '⚙️' }, '⚙️')).toBe(true)
    expect(iconUnchanged({ id: 3, icon: '⚙️' }, '⛵')).toBe(false)
    expect(iconUnchanged({ id: 3 }, '🗂️')).toBe(false)
  })

  it('a group not saved yet has nothing to save', () => {
    expect(iconUnchanged({ icon: '⚙️' }, '⛵')).toBe(true)
  })
})

describe('changeGroupIcon', () => {
  it('saves the icon with the name the group has, and resolves to null', async () => {
    const { api, calls } = fakeUpdater()

    expect(await changeGroupIcon({ id: 3, name: 'Winches' }, '⛵', api)).toBeNull()
    expect(calls).toEqual([{ id: 3, groupInput: { name: 'Winches', icon: '⛵' } }])
  })

  it('resolves to the reason the backend gives, or a fallback', async () => {
    expect(await changeGroupIcon({ id: 3, name: 'Winches' }, '⛵', fakeUpdater(refused('group not found', 404)).api)).toBe('group not found')
    expect(await changeGroupIcon({ id: 3, name: 'Winches' }, '⛵', fakeUpdater(new Error('network')).api)).toBe('Failed to change the group icon')
  })
})

describe('deleteGroupText', () => {
  const winches = { id: 1, name: 'Winches' }

  it('counts its equipments, decommissioned ones included, and says they are kept', () => {
    expect(deleteGroupText(winches, [{ groupId: 1 }, { groupId: 1 }, { groupId: 2 }, {}]))
      .toBe('Delete the group "Winches"? Its 2 equipments are kept and no longer belong to a group.')
  })

  it('says it in the singular for one equipment', () => {
    expect(deleteGroupText(winches, [{ groupId: 1 }])).toBe('Delete the group "Winches"? Its 1 equipment is kept and no longer belongs to a group.')
  })

  it('says when the group has none', () => {
    expect(deleteGroupText(winches, [{ groupId: 2 }])).toBe('Delete the group "Winches"? It has no equipment.')
  })
})

describe('deleteGroup', () => {
  function fakeDeleter(failure?: Error) {
    const calls: { id: number }[] = []
    const api: GroupDeleter = {
      async deleteGroup(req) {
        calls.push(req)
        if (failure) throw failure
      },
    }
    return { api, calls }
  }

  it('deletes the group, and resolves to null', async () => {
    const { api, calls } = fakeDeleter()

    expect(await deleteGroup({ id: 3 }, api)).toBeNull()
    expect(calls).toEqual([{ id: 3 }])
  })

  it('resolves to the reason the backend gives, or a fallback', async () => {
    expect(await deleteGroup({ id: 3 }, fakeDeleter(refused('group not found', 404)).api)).toBe('group not found')
    expect(await deleteGroup({ id: 3 }, fakeDeleter(new Error('network')).api)).toBe('Failed to delete group')
  })
})
