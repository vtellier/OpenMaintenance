import { extractErrorMessage } from '@/lib/format'

// An intervention's photos, in the intervention form once it is saved
// (doc/gui/interventions.md, "Photos"). Each change is saved at once,
// whatever the form's Save or Cancel.

/** The parts of the generated InterventionApi the photos save through. */
export interface PhotoUploader {
  uploadInterventionFile(req: { id: number, file: Blob }): Promise<unknown>
}

export interface PhotoDeleter {
  deleteInterventionFile(req: { id: number, filename: string }): Promise<unknown>
}

/**
 * Uploads the photos picked, one after the other, stopping at the first one
 * refused. Resolves to null once all are saved, or to the reason the first
 * refusal gives, as the backend gives it (#129).
 */
export async function uploadPhotos(interventionId: number, files: Blob[], api: PhotoUploader): Promise<string | null> {
  try {
    for (const file of files) await api.uploadInterventionFile({ id: interventionId, file })
    return null
  } catch (err: unknown) {
    return extractErrorMessage(err, 'Failed to upload photo')
  }
}

/**
 * Deletes one photo, by its stored file name. Resolves to null on success, or
 * to the message to show: always "Failed to delete photo", whatever the
 * backend says.
 */
export async function deletePhoto(interventionId: number, filename: string, api: PhotoDeleter): Promise<string | null> {
  try {
    await api.deleteInterventionFile({ id: interventionId, filename })
    return null
  } catch {
    return 'Failed to delete photo'
  }
}
