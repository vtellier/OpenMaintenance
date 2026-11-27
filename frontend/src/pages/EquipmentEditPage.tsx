import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { EquipmentApi, GroupApi, TaskApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { GroupPicker } from '@/components/GroupPicker'
import { IconPicker } from '@/components/IconPicker'
import { today } from '@/lib/calendar-date'
import type { CalendarDate } from '@/lib/calendar-date'
import { canSaveEdit, decommissioningInvalid, editFormOf, lastReadingHint, saveEdit, turningOn } from '@/lib/equipmentForm'
import type { EquipmentEditValues } from '@/lib/equipmentForm'
import { hoursFromInput } from '@/lib/hoursForm'
import { toEquipmentRow, toGroupRow } from '@/lib/rows'
import type { GroupRow } from '@/lib/rows'

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)
const groupApi = new GroupApi(apiConfig)

/**
 * Edit equipment: its fields, its group, its decommissioning date and its
 * hour-meter, which asks for a reading only while turning it on
 * (doc/gui/equipments.md).
 */
export function EquipmentEditPage({ equipmentId }: { equipmentId: number }) {
  const backHref = '/equipments/' + equipmentId
  // Null until the equipment has loaded.
  const [form, setForm] = useState<EquipmentEditValues | null>(null)
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmTracks, setShowConfirmTracks] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function load() {
      try {
        const [equipment, loadedGroups] = await Promise.all([
          equipmentApi.getEquipment({ id: equipmentId }, { signal }),
          groupApi.listGroups({ signal }),
        ])
        if (signal.aborted) return
        setGroups(loadedGroups.map(toGroupRow))
        setForm(editFormOf(toEquipmentRow(equipment)))
      } catch {
        if (signal.aborted) return
        setError('Failed to load equipment')
      }
      setLoaded(true)
    }
    load()
    return () => controller.abort()
  }, [equipmentId])

  const todayDate = today()

  // confirmed: the user has confirmed turning the hour-meter on.
  async function onSubmit(confirmed: boolean) {
    if (saving || !form || !canSaveEdit(form, todayDate)) return
    setSaving(true)
    setError(null)
    const result = await saveEdit(form, equipmentId, { equipments: equipmentApi, tasks: taskApi }, confirmed)
    if ('saved' in result) {
      window.location.href = backHref
      return
    }
    if ('needsConfirmation' in result) setShowConfirmTracks(true)
    else setError(result.error)
    setSaving(false)
  }

  let content: ReactNode
  if (!loaded) content = <p className="page__empty">Loading...</p>
  else if (!form || (error && !form.name)) content = <div className="flash flash--error">{error}</div>
  else {
    content = (
      <>
        <h1>Edit equipment</h1>

        {error && <div className="flash flash--error">{error}</div>}

        <EditForm
          form={form}
          groups={groups}
          today={todayDate}
          backHref={backHref}
          saving={saving}
          onChange={setForm}
          onGroupCreated={g => setGroups(gs => [...gs, g])}
          onSubmit={() => onSubmit(false)}
        />

        {showConfirmTracks && (
          <ConfirmTracksModal
            onCancel={() => setShowConfirmTracks(false)}
            onEnable={() => { setShowConfirmTracks(false); onSubmit(true) }}
          />
        )}
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

interface EditFormProps {
  form: EquipmentEditValues
  groups: GroupRow[]
  today: CalendarDate
  backHref: string
  saving: boolean
  onChange: (form: EquipmentEditValues) => void
  onGroupCreated: (group: GroupRow) => void
  onSubmit: () => void
}

/** The edit form's fields and its Cancel and Save buttons. */
function EditForm({ form, groups, today, backHref, saving, onChange, onGroupCreated, onSubmit }: EditFormProps) {
  const set = (fields: Partial<EquipmentEditValues>) => onChange({ ...form, ...fields })
  const hint = lastReadingHint(form)

  return (
    <div className="form-page">
      <div className="form-field">
        <label className="form-field__label">Name *</label>
        <input placeholder="e.g. Main Engine" value={form.name} onChange={e => set({ name: e.target.value })} />
      </div>
      <div className="form-field">
        <label className="form-field__label">Description</label>
        <textarea placeholder="Optional description" value={form.description} onChange={e => set({ description: e.target.value })}></textarea>
      </div>
      <div className="form-field">
        <label className="form-field__label">Icon</label>
        <IconPicker current={form.icon} onSelect={icon => set({ icon })} />
        <p className="form-field__hint">Shown in lists and the dashboard. Defaults to 🔧.</p>
      </div>
      <div className="form-field">
        <label className="form-field__label">Group</label>
        <GroupPicker
          groups={groups}
          current={form.groupId}
          onSelect={groupId => set({ groupId })}
          onCreated={onGroupCreated}
        />
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor="commissioned-at">Date of commissioning</label>
        <input id="commissioned-at" type="date" value={form.commissionedAt} onChange={e => set({ commissionedAt: e.target.value })} />
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor="decommissioned-at">Decommissioned on</label>
        <input
          id="decommissioned-at"
          type="date"
          min={form.commissionedAt}
          max={today}
          value={form.decommissionedAt}
          onChange={e => set({ decommissionedAt: e.target.value })}
        />
        <p className="form-field__hint">Set when the equipment leaves service. Its tasks are no longer due; its history is kept.</p>
        {decommissioningInvalid(form, today) && <p className="form-field__error">Cannot be after today, nor before the date of commissioning.</p>}
      </div>
      <div className="toggle-row">
        <span className="toggle-row__label">This equipment has an hour-meter</span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            aria-label="This equipment has an hour-meter"
            checked={form.tracksHours}
            onChange={() => set({ tracksHours: !form.tracksHours })}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>
      {turningOn(form) && (
        <div className="form-field">
          <label className="form-field__label">Current hours</label>
          <input
            type="number"
            aria-label="Current hours"
            min={String(form.minHours)}
            value={String(form.hours)}
            onChange={e => set({ hours: hoursFromInput(e.target.value) })}
          />
          {hint && <p className="form-field__hint">{hint}</p>}
        </div>
      )}
      <div className="form__actions">
        <a href={backHref} className="btn">Cancel</a>
        <button className="btn btn--accent" onClick={onSubmit} disabled={saving || !canSaveEdit(form, today)}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}

/**
 * Asked when the save turns the hour-meter on and a task has an hours
 * interval. As on pre-react, a click anywhere in the overlay closes it, the
 * modal's own content included (the click bubbles up to the overlay).
 */
function ConfirmTracksModal({ onCancel, onEnable }: { onCancel: () => void, onEnable: () => void }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal">
        <h2 className="modal__title">Enable hour-meter tracking?</h2>
        <p className="confirm-text">This equipment has tasks with hour-based intervals. Enabling hour-meter tracking will link those intervals to the equipment's hour-meter.</p>
        <div className="modal__actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn--accent" onClick={onEnable}>Enable</button>
        </div>
      </div>
    </div>
  )
}
