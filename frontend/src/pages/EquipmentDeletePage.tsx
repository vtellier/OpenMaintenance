import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { EquipmentApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { deleteEquipment } from '@/lib/equipmentForm'
import { toEquipmentRow } from '@/lib/rows'

const equipmentApi = new EquipmentApi(apiConfig)

/**
 * Delete equipment: asks first, then deletes the equipment with its tasks,
 * interventions and files, and opens the Equipments list
 * (doc/gui/equipments.md, "Flow: Delete an equipment").
 */
export function EquipmentDeletePage({ equipmentId }: { equipmentId: number }) {
  const backHref = '/equipments/' + equipmentId
  const [name, setName] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function load() {
      try {
        const eq = toEquipmentRow(await equipmentApi.getEquipment({ id: equipmentId }, { signal }))
        if (signal.aborted) return
        setName(eq.name ?? '')
      } catch {
        if (signal.aborted) return
        setLoadError(true)
      }
      setLoaded(true)
    }
    load()
    return () => controller.abort()
  }, [equipmentId])

  async function onConfirm() {
    if (deleting) return
    setDeleting(true)
    setError(null)
    const failure = await deleteEquipment(equipmentId, equipmentApi)
    if (failure === null) {
      window.location.href = '/equipments'
      return
    }
    setError(failure)
    setDeleting(false)
  }

  let content: ReactNode
  if (!loaded) content = <p className="page__empty">Loading...</p>
  else if (loadError) content = <p className="page__empty">Failed to load equipment.</p>
  else {
    content = (
      <>
        <h1>Delete equipment</h1>

        {error && <div className="flash flash--error">{error}</div>}

        <p className="confirm-text">Are you sure you want to delete <strong>{name}</strong>? This will also delete all associated tasks and interventions. This action cannot be undone.</p>

        <div className="form__actions">
          <a href={backHref} className="btn">Cancel</a>
          <button className="btn btn--danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </>
    )
  }

  return (
    <section className="page">
      <a href={backHref} className="back-link">&larr; Back</a>
      {content}
    </section>
  )
}
