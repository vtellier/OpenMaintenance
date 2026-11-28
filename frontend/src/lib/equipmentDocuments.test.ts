import { describe, expect, it } from 'vitest'
import { ResponseError } from '@generated/api/runtime'
import {
  deleteDocument, DocumentDeleter, documentMetaClassName, documentMetaText, DocumentUploader, uploadDocument,
} from '@/lib/equipmentDocuments'

// An equipment's Documents tab (doc/gui/equipments.md, "Documents tab").

const refused = (error: string, status: number) => new ResponseError(new Response(JSON.stringify({ error }), { status }))
// Noon, local time: the same day in every timezone the tests run in.
const uploadedAt = new Date(2026, 10, 1, 12).toISOString()

describe('documentMetaClassName', () => {
  it('marks a file missing on the server (#122)', () => {
    expect(documentMetaClassName({ missing: true })).toBe('doc-row__meta doc-row__meta--missing')
  })

  it('leaves a file on the server plain', () => {
    expect(documentMetaClassName({ missing: false })).toBe('doc-row__meta')
    expect(documentMetaClassName({})).toBe('doc-row__meta')
  })
})

describe('documentMetaText', () => {
  it("reads the file's size and its upload date", () => {
    expect(documentMetaText({ size: 2048, uploadedAt, missing: false })).toBe('2.0 KB • 2026-11-01')
    expect(documentMetaText({ size: 25, uploadedAt, missing: false })).toBe('25 B • 2026-11-01')
  })

  it('says a missing file is missing, never "0 B" (#122)', () => {
    expect(documentMetaText({ size: 0, uploadedAt, missing: true })).toBe('File missing on server • 2026-11-01')
  })
})

describe('uploadDocument', () => {
  function fakeApi(failure?: Error) {
    const calls: { equipmentId: number, file: Blob }[] = []
    const api: DocumentUploader = {
      async uploadEquipmentFile(req) {
        calls.push(req)
        if (failure) throw failure
      },
    }
    return { api, calls }
  }
  const file = new Blob(['%PDF-1.4'])

  it('uploads the file to the equipment, and resolves to null', async () => {
    const { api, calls } = fakeApi()

    expect(await uploadDocument(7, file, api)).toBeNull()
    expect(calls).toEqual([{ equipmentId: 7, file }])
  })

  it('resolves to the reason the backend gives for a refusal (#119)', async () => {
    expect(await uploadDocument(7, file, fakeApi(refused('file exceeds the 50 MB limit', 413)).api)).toBe('file exceeds the 50 MB limit')
  })

  it('resolves to "Failed to upload document" without a reason', async () => {
    expect(await uploadDocument(7, file, fakeApi(new Error('network')).api)).toBe('Failed to upload document')
  })
})

describe('deleteDocument', () => {
  function fakeApi(failure?: Error) {
    const calls: { equipmentId: number, filename: string }[] = []
    const api: DocumentDeleter = {
      async deleteEquipmentFile(req) {
        calls.push(req)
        if (failure) throw failure
      },
    }
    return { api, calls }
  }

  it('deletes the document by its stored name, and resolves to null', async () => {
    const { api, calls } = fakeApi()

    expect(await deleteDocument(7, 'abc.pdf', api)).toBeNull()
    expect(calls).toEqual([{ equipmentId: 7, filename: 'abc.pdf' }])
  })

  it('resolves to "Failed to delete document", whatever the backend says', async () => {
    expect(await deleteDocument(7, 'abc.pdf', fakeApi(refused('file not found', 404)).api)).toBe('Failed to delete document')
  })
})
