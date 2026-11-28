import { describe, expect, it } from 'vitest'
import { ResponseError } from '@generated/api/runtime'
import { deletePhoto, PhotoDeleter, PhotoUploader, uploadPhotos } from '@/lib/interventionPhotos'

// An intervention's photos (doc/gui/interventions.md, "Photos").

const refused = (error: string, status: number) => new ResponseError(new Response(JSON.stringify({ error }), { status }))

describe('uploadPhotos', () => {
  function fakeApi(failAt?: number, failure: Error = new Error('network')) {
    const calls: { id: number, file: Blob }[] = []
    const api: PhotoUploader = {
      async uploadInterventionFile(req) {
        calls.push(req)
        if (calls.length === failAt) throw failure
      },
    }
    return { api, calls }
  }
  const a = new Blob(['a'])
  const b = new Blob(['b'])

  it('uploads each photo in turn, and resolves to null', async () => {
    const { api, calls } = fakeApi()

    expect(await uploadPhotos(7, [a, b], api)).toBeNull()
    expect(calls).toEqual([{ id: 7, file: a }, { id: 7, file: b }])
  })

  it('stops at the first refusal, with the reason the backend gives (#129)', async () => {
    const { api, calls } = fakeApi(1, refused('file exceeds the 10 MB limit', 413))

    expect(await uploadPhotos(7, [a, b], api)).toBe('file exceeds the 10 MB limit')
    expect(calls).toEqual([{ id: 7, file: a }])
  })

  it('resolves to a fallback without a reason', async () => {
    const { api } = fakeApi(2)

    expect(await uploadPhotos(7, [a, b], api)).toBe('Failed to upload photo')
  })
})

describe('deletePhoto', () => {
  function fakeApi(failure?: Error) {
    const calls: { id: number, filename: string }[] = []
    const api: PhotoDeleter = {
      async deleteInterventionFile(req) {
        calls.push(req)
        if (failure) throw failure
      },
    }
    return { api, calls }
  }

  it('deletes the photo by its stored name, and resolves to null', async () => {
    const { api, calls } = fakeApi()

    expect(await deletePhoto(7, 'abc.jpg', api)).toBeNull()
    expect(calls).toEqual([{ id: 7, filename: 'abc.jpg' }])
  })

  it('resolves to "Failed to delete photo", whatever the backend says', async () => {
    const { api } = fakeApi(refused('file not found', 404))

    expect(await deletePhoto(7, 'abc.jpg', api)).toBe('Failed to delete photo')
  })
})
