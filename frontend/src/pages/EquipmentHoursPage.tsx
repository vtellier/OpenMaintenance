import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { EquipmentApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { formatHours } from '@/lib/format'
import { canUpdateHours, hoursFromInput, hoursUpdateFormOf, saveHoursUpdate } from '@/lib/hoursForm'
import type { HoursUpdateValues } from '@/lib/hoursForm'
import { toEquipmentRow } from '@/lib/rows'
import { formatTimestampDate } from '@/lib/timestamp'
import type { IsoTimestamp } from '@/lib/timestamp'

const equipmentApi = new EquipmentApi(apiConfig)

/**
 * Update hours: a new hour-meter reading, not below the current one; the same
 * one confirms it (doc/gui/equipments.md, "Flow: Update hour-meter").
 */
export function EquipmentHoursPage({ equipmentId }: { equipmentId: number }) {
  const backHref = '/equipments/' + equipmentId
  const [name, setName] = useState('')
  const [form, setForm] = useState<HoursUpdateValues>({ currentHours: 0, newHours: 0 })
  const [lastUpdated, setLastUpdated] = useState<IsoTimestamp | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function load() {
      try {
        const eq = toEquipmentRow(await equipmentApi.getEquipment({ id: equipmentId }, { signal }))
        if (signal.aborted) return
        setName(eq.name ?? '')
        setForm(hoursUpdateFormOf(eq))
        setLastUpdated(eq.hoursUpdatedAt ?? null)
      } catch {
        if (signal.aborted) return
        setError('Failed to load equipment')
      }
      setLoaded(true)
    }
    load()
    return () => controller.abort()
  }, [equipmentId])

  const canSave = canUpdateHours(form)

  async function onSubmit() {
    if (saving || !canSave) return
    setSaving(true)
    setError(null)
    const failure = await saveHoursUpdate(form, equipmentId, equipmentApi)
    if (failure === null) {
      window.location.href = backHref
      return
    }
    setError(failure)
    setSaving(false)
  }

  let content: ReactNode
  if (!loaded) content = <p className="page__empty">Loading...</p>
  else if (error && !name) content = <div className="flash flash--error">{error}</div>
  else {
    content = (
      <>
        <h1>Update hours</h1>

        {error && <div className="flash flash--error">{error}</div>}

        <div className="form-page">
          <p className="confirm-text">Updating hours for <strong>{name}</strong></p>

          <div className="form-field">
            <label className="form-field__label">Current hours</label>
            <p>{formatHours(form.currentHours)}</p>
          </div>

          {lastUpdated && (
            <div className="form-field">
              <label className="form-field__label">Last updated</label>
              <p>{formatTimestampDate(lastUpdated)}</p>
            </div>
          )}

          <div className="form-field">
            <label className="form-field__label">New hours</label>
            <input
              type="number"
              aria-label="New hours"
              min={String(form.currentHours)}
              value={String(form.newHours)}
              onChange={e => setForm({ ...form, newHours: hoursFromInput(e.target.value) })}
            />
          </div>

          <div className="form__actions">
            <a href={backHref} className="btn">Cancel</a>
            <button className="btn btn--accent" onClick={onSubmit} disabled={saving || !canSave}>
              {saving ? 'Saving...' : 'Update hours'}
            </button>
          </div>
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
