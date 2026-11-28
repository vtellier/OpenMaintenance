import { useState } from 'react'
import type { MouseEvent } from 'react'
import { InterventionApi } from '@generated/api'
import type { Equipment } from '@generated/api/models/Equipment'
import type { Task } from '@generated/api/models/Task'
import { apiConfig } from '@/api/config'
import { ExpiryDateField } from '@/components/ExpiryDateField'
import { InterventionPhotos } from '@/components/InterventionPhotos'
import type { DecommissionableEquipment } from '@/lib/decommissioning'
import { readingFromInput } from '@/lib/hoursForm'
import {
  canSave, doubtLeftByEdit, equipmentChoices, formTitle, isExpiryTask, prefill, save, selectEquipment, showsHours, taskChoices, withExceptional,
} from '@/lib/interventionForm'
import type { InterventionFormSource, InterventionFormValues } from '@/lib/interventionForm'
import type { InterventionReading, ReadingDoubt } from '@/lib/readingDoubt'

const interventionApi = new InterventionApi(apiConfig)

export interface FullInterventionModalProps {
  /** What the form opens for: a new log, Done on a task row, or an intervention to edit. */
  source: InterventionFormSource
  equipments: (Pick<Equipment, 'id' | 'name' | 'tracksHours' | 'hours'> & DecommissionableEquipment)[]
  /** Every task the page has loaded; the Task picker offers the picked equipment's. */
  tasks: Pick<Task, 'id' | 'name' | 'equipmentId' | 'kind'>[]
  /** The interventions the page has loaded, to tell whether an edit leaves the reading in doubt. */
  interventions: InterventionReading[]
  /** Hides the equipment picker: the form is opened from that equipment's page. */
  equipmentIdFixed?: number
  onClose: () => void
  /** Called once saved, with the doubt an edit leaves on the equipment's reading, if any. */
  onSaved: (doubt: ReadingDoubt | null) => void | Promise<void>
}

/**
 * The full intervention form (log, Done and edit; doc/gui/interventions.md).
 * It prefills itself once, when it opens, from what it opens for and the
 * page's data then; data that arrives later updates its pickers but never
 * resets what the user typed (#73). It validates and saves through
 * lib/interventionForm.ts. The page renders it while open, closes it, and
 * reloads its data once it has saved.
 */
export function FullInterventionModal({ source, equipments, tasks, interventions, equipmentIdFixed, onClose, onSaved }: FullInterventionModalProps) {
  const ctx = { equipments, tasks, interventions }
  const [form, setForm] = useState<InterventionFormValues>(() => prefill(source, ctx))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (fields: Partial<InterventionFormValues>) => setForm({ ...form, ...fields })

  function chooseEquipment(value: string) {
    const next = { ...form }
    selectEquipment(next, value ? parseInt(value, 10) : null, ctx)
    setForm(next)
  }

  async function onSave() {
    if (saving || !canSave(form, ctx)) return
    setSaving(true)
    setError(null)
    // From the reading and the interventions as they are before the save.
    const doubt = doubtLeftByEdit(source, form, ctx)
    const failure = await save(form, ctx, interventionApi)
    setSaving(false)
    if (failure) setError(failure)
    else await onSaved(doubt)
  }

  // Any overlay closes the form, the photo delete
  // confirmation's included: a click on it bubbles up to this one.
  function onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) onClose()
  }

  return (
    <div className="modal-overlay" onClick={onOverlayClick}>
      <div className="modal">
        <h2 className="modal__title">{formTitle(form)}</h2>
        {error && <div className="flash flash--error">{error}</div>}

        {equipmentIdFixed == null && (
          <div className="form-field">
            <label className="form-field__label">Equipment *</label>
            <select aria-label="Equipment" value={form.equipmentId != null ? String(form.equipmentId) : ''} onChange={e => chooseEquipment(e.target.value)}>
              <option value="">-- Select equipment --</option>
              {equipmentChoices(equipments).map(eq => (
                <option key={eq.id} value={String(eq.id)}>{eq.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-field form-field--inline">
          <label className="form-field__checkbox-label">
            <input type="checkbox" checked={form.isExceptional} onChange={e => setForm(withExceptional(form, e.target.checked))} /> Exceptional intervention
          </label>
          <span className="info-icon" data-tooltip="Exceptional interventions are one-off operations not part of your maintenance plan (e.g. replacing a broken part). They appear in the history but do not affect task due dates.">ⓘ</span>
        </div>

        <div className="form-field">
          <label className="form-field__label">Task *</label>
          <select
            aria-label="Task"
            value={form.taskId != null ? String(form.taskId) : ''}
            onChange={e => set({ taskId: e.target.value ? parseInt(e.target.value, 10) : null })}
            disabled={form.isExceptional}
          >
            <option value="">-- Select task --</option>
            {taskChoices(form, tasks).map(t => (
              <option key={t.id} value={String(t.id)}>{t.name}</option>
            ))}
          </select>
        </div>

        {form.isExceptional && (
          <div className="form-field">
            <label className="form-field__label">Exceptional intervention *</label>
            <input placeholder="e.g. Replaced broken impeller" value={form.exceptionalLabel} onChange={e => set({ exceptionalLabel: e.target.value })} />
          </div>
        )}

        <div className="form-field">
          <label className="form-field__label">Date *</label>
          <input type="date" aria-label="Date" value={form.date} onChange={e => set({ date: e.target.value })} />
        </div>

        {showsHours(form, ctx) && (
          <div className="form-field">
            <label className="form-field__label">Hours</label>
            <input
              type="number"
              min="0"
              aria-label="Hours"
              value={form.hours == null ? '' : String(form.hours)}
              onChange={e => set({ hours: readingFromInput(e.target.value) })}
            />
          </div>
        )}

        {isExpiryTask(form, ctx) && <ExpiryDateField value={form.expiryDate} onChange={expiryDate => set({ expiryDate })} />}

        <div className="form-field">
          <label className="form-field__label">Location</label>
          <input placeholder="e.g. Marina X, Home garage" aria-label="Location" value={form.location} onChange={e => set({ location: e.target.value })} />
        </div>

        <div className="form-field">
          <label className="form-field__label">Done by</label>
          <input placeholder="e.g. Self, Garage du Port" value={form.performedBy} onChange={e => set({ performedBy: e.target.value })} />
        </div>

        <div className="form-field">
          <label className="form-field__label">Comments</label>
          <textarea placeholder="Optional notes" value={form.comments} onChange={e => set({ comments: e.target.value })}></textarea>
        </div>

        {/* Photos attach to a saved intervention only: they need its id. */}
        {form.editId != null
          ? <InterventionPhotos interventionId={form.editId} />
          : <p className="photo-hint">Save the intervention to attach photos.</p>}

        <div className="modal__actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--accent" onClick={onSave} disabled={saving || !canSave(form, ctx)}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
