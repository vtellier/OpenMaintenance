import { useState } from 'react'
import { InterventionApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { deleteIntervention } from '@/lib/interventionForm'
import type { InterventionReading, ReadingDoubt, ReadingDoubtContext } from '@/lib/readingDoubt'

const interventionApi = new InterventionApi(apiConfig)

export interface DeleteInterventionModalProps {
  intervention: InterventionReading
  /** The page's data as it is before the delete, to tell whether the delete leaves the reading in doubt. */
  context: ReadingDoubtContext
  onCancel: () => void
  /** Called once deleted, with the doubt the delete leaves on the equipment's reading, if any. */
  onDeleted: (doubt: ReadingDoubt | null) => void | Promise<void>
}

/**
 * The confirmation before an intervention is deleted, from History or an
 * equipment's History tab (doc/gui/interventions.md, "Editing / deleting an
 * intervention"). It deletes through deleteIntervention; the page closes it
 * and reloads once it has deleted. A refused delete keeps it open, with the
 * reason.
 */
export function DeleteInterventionModal({ intervention, context, onCancel, onDeleted }: DeleteInterventionModalProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDelete() {
    if (deleting || intervention.id == null) return
    setDeleting(true)
    setError(null)
    const result = await deleteIntervention(intervention, context, interventionApi)
    if ('error' in result) {
      setError(result.error)
      setDeleting(false)
      return
    }
    await onDeleted(result.doubt)
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal">
        <h2 className="modal__title">Delete intervention</h2>
        {error && <div className="flash flash--error">{error}</div>}
        <p className="confirm-text">Are you sure you want to delete this intervention? Task due dates will be recomputed from the remaining history. The equipment's hour-meter reading is not lowered.</p>
        <div className="modal__actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn--danger" onClick={onDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
