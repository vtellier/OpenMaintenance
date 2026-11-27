import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { EquipmentApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { canCorrect, currentReadingText, prefilledReading, readingFromInput, saveCorrection } from '@/lib/hoursForm'
import { toEquipmentRow } from '@/lib/rows'
import { formatTimestampDate } from '@/lib/timestamp'
import type { IsoTimestamp } from '@/lib/timestamp'

const equipmentApi = new EquipmentApi(apiConfig)

/**
 * "Correct reading": the deliberate way to fix a wrong reading, the only one
 * that can lower it (doc/gui/equipments.md, "Flow: Correct the reading").
 * `?hours=` prefills the Corrected reading.
 */
export function EquipmentCorrectHoursPage({ equipmentId }: { equipmentId: number }) {
  const backHref = '/equipments/' + equipmentId
  const [name, setName] = useState('')
  const [currentHours, setCurrentHours] = useState<number | null>(null)
  const [newHours, setNewHours] = useState(() => prefilledReading(window.location.search))
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
        setCurrentHours(eq.hours ?? null)
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

  const canSave = !saving && canCorrect(newHours)

  async function onSubmit() {
    const hours = newHours
    if (saving || !canCorrect(hours)) return
    setSaving(true)
    setError(null)
    const failure = await saveCorrection(hours, equipmentId, equipmentApi)
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
        <h1>Correct reading</h1>

        {error && <div className="flash flash--error">{error}</div>}

        <div className="form-page">
          <p className="confirm-text">Correcting the hour-meter reading of <strong>{name}</strong>.</p>

          <div className="form-field">
            <label className="form-field__label">Current reading</label>
            <p>{currentReadingText(currentHours)}</p>
          </div>

          {lastUpdated && (
            <div className="form-field">
              <label className="form-field__label">Last updated</label>
              <p>{formatTimestampDate(lastUpdated)}</p>
            </div>
          )}

          <div className="form-field">
            <label className="form-field__label" htmlFor="corrected-reading">Corrected reading</label>
            <input
              id="corrected-reading"
              type="number"
              min="0"
              value={newHours == null ? '' : String(newHours)}
              onChange={e => setNewHours(readingFromInput(e.target.value))}
            />
          </div>

          <p className="confirm-text">The reading becomes this value, even if it is lower than the current one.</p>

          <div className="form__actions">
            <a href={backHref} className="btn">Cancel</a>
            <button className="btn btn--accent" onClick={onSubmit} disabled={!canSave}>
              {saving ? 'Saving...' : 'Correct reading'}
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
