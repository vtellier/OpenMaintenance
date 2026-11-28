import { extractErrorMessage, formatFileSize } from '@/lib/format'
import { formatTimestampDate, Timestamp } from '@/lib/timestamp'

// An equipment's Documents tab (doc/gui/equipments.md, "Documents tab",
// "Flow: Upload a document", "Flow: Delete a document"): what a row says,
// and the upload and the delete.

type DocumentMetaFile = { size?: number; uploadedAt?: Timestamp; missing?: boolean }

/**
 * The class of a row's size and date line: marked when the file is gone from
 * the server (#122).
 */
export function documentMetaClassName(file: Pick<DocumentMetaFile, 'missing'>): string {
  return file.missing ? 'doc-row__meta doc-row__meta--missing' : 'doc-row__meta'
}

/**
 * A row's size and upload date, "2.0 KB • 2026-11-01". A file gone from the
 * server reads "File missing on server" in place of its size (#122): its
 * size is 0.
 */
export function documentMetaText(file: DocumentMetaFile): string {
  return (file.missing ? 'File missing on server' : formatFileSize(file.size)) + ' • ' + formatTimestampDate(file.uploadedAt)
}

/** The part of the generated EquipmentApi a document is uploaded through. */
export interface DocumentUploader {
  uploadEquipmentFile(req: { equipmentId: number, file: Blob }): Promise<unknown>
}

/** The part of the generated EquipmentApi a document is deleted through. */
export interface DocumentDeleter {
  deleteEquipmentFile(req: { equipmentId: number, filename: string }): Promise<unknown>
}

/**
 * Uploads one document to the equipment. Resolves to null once saved, or to
 * the reason the backend gives for refusing it ("file exceeds the 50 MB
 * limit"); "Failed to upload document" when it gives none (#119).
 */
export async function uploadDocument(equipmentId: number, file: Blob, api: DocumentUploader): Promise<string | null> {
  try {
    await api.uploadEquipmentFile({ equipmentId, file })
    return null
  } catch (err: unknown) {
    return extractErrorMessage(err, 'Failed to upload document')
  }
}

/**
 * Deletes one document, by its stored file name. Resolves to null on
 * success, or to the message to show: always "Failed to delete document",
 * whatever the backend says.
 */
export async function deleteDocument(equipmentId: number, filename: string, api: DocumentDeleter): Promise<string | null> {
  try {
    await api.deleteEquipmentFile({ equipmentId, filename })
    return null
  } catch {
    return 'Failed to delete document'
  }
}
