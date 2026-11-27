import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { InterventionApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { deletePhoto, uploadPhotos } from '@/lib/interventionPhotos'
import { toFileRow } from '@/lib/rows'
import type { FileRow } from '@/lib/rows'

const interventionApi = new InterventionApi(apiConfig)

/**
 * The photos of a saved intervention, in the intervention form: the grid,
 * "+ Add photo", a confirmation before each delete, and a full-screen viewer
 * (doc/gui/interventions.md, "Photos"). Each change is saved at once,
 * whatever the form's Save or Cancel, so the section says so. Its state is
 * its own, dropped when the form closes.
 */
export function InterventionPhotos({ interventionId }: { interventionId: number }) {
  const [photos, setPhotos] = useState<FileRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  // The stored name of the photo being deleted.
  const [deletingName, setDeletingName] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<FileRow | null>(null)
  const [viewing, setViewing] = useState<FileRow | null>(null)

  const reload = useCallback(async (signal?: AbortSignal) => {
    try {
      const files = await interventionApi.listInterventionFiles({ id: interventionId }, { signal })
      if (signal?.aborted) return
      setPhotos(files.map(toFileRow))
      setError(null)
    } catch {
      if (signal?.aborted) return
      setError('Failed to load photos')
    }
    setLoaded(true)
  }, [interventionId])

  useEffect(() => {
    const controller = new AbortController()
    reload(controller.signal)
    return () => controller.abort()
  }, [reload])

  async function onUploadChange(e: ChangeEvent<HTMLInputElement>) {
    // Read before the first await: React clears currentTarget once the
    // handler returns, and emptying the field empties its live FileList.
    const input = e.currentTarget
    const files = input.files ? Array.from(input.files) : []
    if (uploading || files.length === 0) return
    setUploading(true)
    setError(null)
    const failure = await uploadPhotos(interventionId, files, interventionApi)
    if (failure === null) await reload()
    else setError(failure)
    setUploading(false)
    input.value = ''
  }

  async function onConfirmDelete() {
    const f = confirmDelete
    if (!f || deletingName != null) return
    setDeletingName(f.name)
    setError(null)
    const failure = await deletePhoto(interventionId, f.name, interventionApi)
    setDeletingName(null)
    if (failure !== null) {
      setError(failure)
      return
    }
    if (viewing?.name === f.name) setViewing(null)
    setConfirmDelete(null)
    await reload()
  }

  let content: ReactNode
  if (!loaded) content = <p className="photo-empty">Loading...</p>
  else if (photos.length === 0) content = <p className="photo-empty">No photos yet.</p>
  else {
    content = (
      <div className="photo-grid">
        {photos.map(f => (
          <div key={f.name} className="photo-thumb">
            {f.missing
              // A photo missing on the server has nothing to show full-screen (#122).
              ? <div className="photo-thumb__missing" title={f.originalName}>Photo missing on server</div>
              : <img className="photo-thumb__img" src={f.url} alt={f.originalName} onClick={() => setViewing(f)} />}
            <button className="photo-thumb__del" title="Delete photo" onClick={() => setConfirmDelete(f)} disabled={deletingName === f.name}>×</button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="photo-section">
        <div className="photo-section__header">
          <label className="form-field__label">Photos <span className="photo-section__note">saved immediately</span></label>
          <label className="btn btn--small btn--accent">
            {uploading ? 'Uploading...' : '+ Add photo'}
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onUploadChange} disabled={uploading} />
          </label>
        </div>
        {error && <div className="flash flash--error">{error}</div>}
        {content}
      </div>
      {confirmDelete && (
        <ConfirmPhotoDelete
          photo={confirmDelete}
          deleting={deletingName === confirmDelete.name}
          onCancel={() => setConfirmDelete(null)}
          onDelete={onConfirmDelete}
        />
      )}
      {viewing && (
        <div className="photo-viewer" onClick={e => { if (e.target === e.currentTarget) setViewing(null) }}>
          <img className="photo-viewer__img" src={viewing.url} alt={viewing.originalName} />
        </div>
      )}
    </>
  )
}

interface ConfirmPhotoDeleteProps {
  photo: FileRow
  deleting: boolean
  onCancel: () => void
  onDelete: () => void
}

/**
 * "Delete this photo?", over the intervention form. As on pre-react, a click
 * on its overlay closes it and, bubbling up to the form's overlay, the form
 * too (see FullInterventionModal).
 */
function ConfirmPhotoDelete({ photo, deleting, onCancel, onDelete }: ConfirmPhotoDeleteProps) {
  return (
    <div className="modal-overlay photo-confirm" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal modal--narrow">
        <h2 className="modal__title">Delete photo</h2>
        {photo.missing
          ? <div className="photo-confirm__preview photo-confirm__preview--missing">Photo missing on server</div>
          : <img className="photo-confirm__preview" src={photo.url} alt={photo.originalName} />}
        <p className="confirm-text">Delete this photo? This cannot be undone.</p>
        <div className="modal__actions">
          <button className="btn" onClick={onCancel} disabled={deleting}>Cancel</button>
          <button className="btn btn--danger" onClick={onDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
