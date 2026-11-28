import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { EquipmentApi, InterventionApi, TaskApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { DeleteInterventionModal } from '@/components/DeleteInterventionModal'
import { FullInterventionModal } from '@/components/FullInterventionModal'
import { HistoryList } from '@/components/HistoryList'
import { IconPicker } from '@/components/IconPicker'
import { ReadingDoubtModal } from '@/components/ReadingDoubtModal'
import { formatCalendarDate } from '@/lib/calendar-date'
import { isDecommissioned } from '@/lib/decommissioning'
import { descriptionText, detailHoursClassName, detailTabs, hourMeterText } from '@/lib/equipmentDetail'
import type { DetailTab } from '@/lib/equipmentDetail'
import { deleteDocument, documentMetaClassName, documentMetaText, uploadDocument } from '@/lib/equipmentDocuments'
import { iconChanged, saveIcon, shownIcon } from '@/lib/equipmentForm'
import { formatHours } from '@/lib/format'
import type { InterventionFormSource } from '@/lib/interventionForm'
import { equipmentInterventions, interventionTaskLabel, lastInterventionOfTask, newestFirst } from '@/lib/interventions'
import { stillInDoubt } from '@/lib/readingDoubt'
import type { ReadingDoubt } from '@/lib/readingDoubt'
import { toEquipmentRow, toFileRow, toInterventionRow, toTaskRow } from '@/lib/rows'
import type { EquipmentRow, FileRow, InterventionRow, TaskRow } from '@/lib/rows'
import {
  asksCurrentExpiryDate, canSaveTask, deleteTask, intervalFromInput, intervalValue, newTaskForm, saveTask, taskFormOf, taskKindText,
} from '@/lib/taskForm'
import type { TaskFormValues } from '@/lib/taskForm'
import { dueIndicator, lastDoneText, triggerText } from '@/lib/taskRow'
import { formatTimestampDate, relativeTime } from '@/lib/timestamp'
import { byUrgency } from '@/lib/urgency'

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)
const interventionApi = new InterventionApi(apiConfig)

/**
 * Equipment detail: the header (icon, name, hour-meter, actions), then one of
 * four tabs, each a URL of its own: Tasks, History, Documents and Info
 * (doc/gui/equipments.md, "Equipment detail"; doc/gui/tasks.md). The Tasks
 * tab adds, edits, deletes and marks done the equipment's tasks; History logs,
 * edits and deletes its interventions; Documents uploads and deletes its files.
 * `tab` is the tab the URL names: '' for Tasks, the default.
 */
export function EquipmentDetailPage({ equipmentId, tab }: { equipmentId: number; tab: DetailTab }) {
  const [equipment, setEquipment] = useState<EquipmentRow | null>(null)
  // The equipment's tasks, and every task: the intervention form and the
  // History tab name an intervention's task from them.
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [allTasks, setAllTasks] = useState<TaskRow[]>([])
  // The equipment's interventions (equipmentInterventions).
  const [interventions, setInterventions] = useState<InterventionRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [iconError, setIconError] = useState<string | null>(null)

  const [addingTask, setAddingTask] = useState(false)
  const [editTarget, setEditTarget] = useState<{ task: TaskRow; hasIntervention: boolean } | null>(null)
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<TaskRow | null>(null)

  // What the intervention form is open for; null while it is closed.
  const [formSource, setFormSource] = useState<InterventionFormSource | null>(null)
  const [deleteInterventionTarget, setDeleteInterventionTarget] = useState<InterventionRow | null>(null)
  // The question about the reading a delete or an edit may have set.
  const [doubt, setDoubt] = useState<ReadingDoubt | null>(null)

  const [documents, setDocuments] = useState<FileRow[]>([])
  const [documentsLoaded, setDocumentsLoaded] = useState(false)
  const [documentsError, setDocumentsError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleteDocTarget, setDeleteDocTarget] = useState<FileRow | null>(null)

  // Resolves to the equipment loaded, or null when the load failed or was
  // aborted. A later success leaves a load error in place: kept on purpose
  // (React skill, "A reload shared by the effect and the handlers"); changing
  // it is its own issue.
  const reload = useCallback(async (signal?: AbortSignal): Promise<EquipmentRow | null> => {
    let fresh: EquipmentRow | null = null
    try {
      const [eq, ts, invs, allTs] = await Promise.all([
        equipmentApi.getEquipment({ id: equipmentId }, { signal }),
        taskApi.listTasksByEquipment({ equipmentId }, { signal }),
        interventionApi.listInterventions({ signal }),
        taskApi.listTasks({ signal }),
      ])
      if (signal?.aborted) return null
      const equipmentTasks = ts.map(toTaskRow)
      fresh = toEquipmentRow(eq)
      setTasks(equipmentTasks)
      setAllTasks(allTs.map(toTaskRow))
      setInterventions(equipmentInterventions(invs.map(toInterventionRow), equipmentId, equipmentTasks))
      setEquipment(fresh)
    } catch {
      if (signal?.aborted) return null
      setLoadError('Failed to load equipment')
    }
    setLoaded(true)
    return fresh
  }, [equipmentId])

  // The documents load on every tab.
  const reloadDocuments = useCallback(async (signal?: AbortSignal) => {
    try {
      const files = await equipmentApi.listEquipmentFiles({ equipmentId }, { signal })
      if (signal?.aborted) return
      setDocuments(files.map(toFileRow))
      setDocumentsError(null)
    } catch {
      if (signal?.aborted) return
      setDocumentsError('Failed to load documents')
    }
    setDocumentsLoaded(true)
  }, [equipmentId])

  useEffect(() => {
    const controller = new AbortController()
    reload(controller.signal)
    return () => controller.abort()
  }, [reload])

  useEffect(() => {
    const controller = new AbortController()
    reloadDocuments(controller.signal)
    return () => controller.abort()
  }, [reloadDocuments])

  // ── Tasks ──

  function openEditTask(task: TaskRow) {
    if (task.id == null) return
    // Asked once, when the form opens.
    setEditTarget({ task, hasIntervention: lastInterventionOfTask(interventions, task.id) != null })
  }

  async function onTaskSaved() {
    setAddingTask(false)
    setEditTarget(null)
    await reload()
  }

  async function onTaskDeleted() {
    setDeleteTaskTarget(null)
    await reload()
  }

  function openDone(task: TaskRow) {
    if (task.id == null) return
    setFormSource({ done: { taskId: task.id } })
  }

  // ── Interventions ──

  // Once a change is saved: reload, then ask about the reading it may have
  // left in doubt, against the reloaded equipment (the one held before, if
  // the reload failed).
  async function reloadAndAsk(before: ReadingDoubt | null) {
    const fresh = (await reload()) ?? equipment
    setDoubt(stillInDoubt(before, fresh ? [fresh] : []))
  }

  async function onFormSaved(before: ReadingDoubt | null) {
    setFormSource(null)
    await reloadAndAsk(before)
  }

  async function onInterventionDeleted(before: ReadingDoubt | null) {
    setDeleteInterventionTarget(null)
    await reloadAndAsk(before)
  }

  // ── Icon ──

  async function changeIcon(icon: string) {
    const eq = equipment
    if (!eq || !iconChanged(eq, icon)) return
    setIconError(null)
    // Optimistic: the new icon shows at once, and the old one comes back if
    // the save fails.
    setEquipment({ ...eq, icon })
    const failure = await saveIcon(eq, icon, equipmentApi)
    if (failure !== null) {
      setEquipment(eq)
      setIconError(failure)
    }
  }

  // ── Documents ──

  async function onUploadChange(e: ChangeEvent<HTMLInputElement>) {
    // Read before the first await: React clears currentTarget once the
    // handler returns.
    const input = e.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const failure = await uploadDocument(equipmentId, file, equipmentApi)
    if (failure === null) await reloadDocuments()
    else setUploadError(failure)
    setUploading(false)
    input.value = ''
  }

  async function onDocumentDeleted() {
    setDeleteDocTarget(null)
    await reloadDocuments()
  }

  let content: ReactNode
  if (!loaded) content = <p className="page__empty">Loading...</p>
  else if (loadError) content = <div className="flash flash--error">{loadError}</div>
  else if (!equipment) content = <p className="page__empty">Equipment not found.</p>
  else {
    const eq = equipment
    content = (
      <>
        <div className="detail-header">
          <div className="detail-header__top">
            <div className="detail-header__title">
              <IconPicker current={eq.icon ?? ''} onSelect={changeIcon} variant="avatar" />
              <h1>{eq.name}</h1>
              {isDecommissioned(eq) && <span className="due-indicator due-indicator--decommissioned">Decommissioned</span>}
            </div>
            <div className="detail-header__actions">
              {eq.tracksHours && <a href={'/equipments/' + equipmentId + '/edit/hours'} className="btn">Update hours</a>}
              {eq.tracksHours && <a href={'/equipments/' + equipmentId + '/edit/hours/correct'} className="btn">Correct reading</a>}
              <a href={'/equipments/' + equipmentId + '/edit'} className="btn">Edit</a>
              <a href={'/equipments/' + equipmentId + '/delete'} className="btn">Delete</a>
            </div>
          </div>
          {eq.tracksHours && (
            <div className="detail-header__hours">
              <span>{formatHours(eq.hours)}</span>
              <span className={detailHoursClassName(eq)}>• updated {relativeTime(eq.hoursUpdatedAt)}</span>
            </div>
          )}
          {eq.commissionedAt ? <div className="detail-header__meta">Commissioned {formatCalendarDate(eq.commissionedAt)}</div> : null}
          {iconError && <div className="flash flash--error">{iconError}</div>}
        </div>

        <nav className="sub-tabs">
          {detailTabs(equipmentId, tab).map(t => <a key={t.tab} href={t.href} className={t.className}>{t.label}</a>)}
        </nav>

        <div className="tab-content">
          {tab === '' && (
            <TasksTab
              tasks={tasks}
              interventions={interventions}
              onAdd={() => setAddingTask(true)}
              onDone={openDone}
              onEdit={openEditTask}
              onDelete={setDeleteTaskTarget}
            />
          )}
          {tab === 'history' && (
            <HistoryTab
              interventions={interventions}
              allTasks={allTasks}
              onLog={() => setFormSource({ new: { equipmentId } })}
              onEdit={inv => setFormSource({ edit: inv })}
              onDelete={setDeleteInterventionTarget}
            />
          )}
          {tab === 'documents' && (
            <DocumentsTab
              documents={documents}
              loaded={documentsLoaded}
              error={documentsError}
              uploading={uploading}
              uploadError={uploadError}
              onUpload={onUploadChange}
              onDelete={setDeleteDocTarget}
            />
          )}
          {tab === 'info' && <InfoTab equipment={eq} />}
        </div>

        {addingTask && (
          <TaskFormModal
            equipmentId={equipmentId}
            hasIntervention={false}
            tracksHours={eq.tracksHours ?? false}
            onClose={() => setAddingTask(false)}
            onSaved={onTaskSaved}
          />
        )}
        {editTarget && (
          <TaskFormModal
            equipmentId={equipmentId}
            task={editTarget.task}
            hasIntervention={editTarget.hasIntervention}
            tracksHours={eq.tracksHours ?? false}
            onClose={() => setEditTarget(null)}
            onSaved={onTaskSaved}
          />
        )}
        {deleteTaskTarget && (
          <DeleteTaskModal task={deleteTaskTarget} onCancel={() => setDeleteTaskTarget(null)} onDeleted={onTaskDeleted} />
        )}
        {deleteDocTarget && (
          <DeleteDocumentModal
            equipmentId={equipmentId}
            file={deleteDocTarget}
            onCancel={() => setDeleteDocTarget(null)}
            onDeleted={onDocumentDeleted}
          />
        )}
        {formSource && (
          <FullInterventionModal
            source={formSource}
            equipments={[eq]}
            tasks={allTasks}
            interventions={interventions}
            equipmentIdFixed={equipmentId}
            onClose={() => setFormSource(null)}
            onSaved={onFormSaved}
          />
        )}
        {doubt && <ReadingDoubtModal doubt={doubt} onKeep={() => setDoubt(null)} />}
        {deleteInterventionTarget && (
          <DeleteInterventionModal
            intervention={deleteInterventionTarget}
            context={{ equipments: [eq], tasks: allTasks, interventions }}
            onCancel={() => setDeleteInterventionTarget(null)}
            onDeleted={onInterventionDeleted}
          />
        )}
      </>
    )
  }

  return (
    <section className="page">
      <a href="/equipments" className="back-link">&larr; Back to equipments</a>
      {content}
    </section>
  )
}

// ── Tabs ──

interface TasksTabProps {
  /** The equipment's tasks; the tab lists them in urgency order. */
  tasks: TaskRow[]
  /** The equipment's interventions, for each task's "Last:". */
  interventions: InterventionRow[]
  onAdd: () => void
  onDone: (task: TaskRow) => void
  onEdit: (task: TaskRow) => void
  onDelete: (task: TaskRow) => void
}

/** The Tasks tab: "+ Add task", then each task with its urgency, trigger and last intervention (doc/gui/tasks.md). */
function TasksTab({ tasks, interventions, onAdd, onDone, onEdit, onDelete }: TasksTabProps) {
  const sorted = [...tasks].sort(byUrgency)
  return (
    <>
      <div className="tab-toolbar">
        <h2>Tasks</h2>
        <button className="btn btn--accent" onClick={onAdd}>+ Add task</button>
      </div>
      {sorted.length === 0
        // The link keeps href="#": the click opens Add task
        // and adds "#" to the URL.
        ? <p className="page__empty">No maintenance tasks yet for this equipment. <a href="#" onClick={onAdd}>Add the first task</a>.</p>
        : (
          <div className="task-list-compact">
            {sorted.map(t => {
              const indicator = dueIndicator(t)
              return (
                <div key={t.id} className="task-row">
                  <div className="task-row__info">
                    <p className="task-row__name">{t.name}</p>
                    {indicator && <p className="task-row__meta"><span className={indicator.className}>{indicator.text}</span></p>}
                    <p className="task-row__interval">{triggerText(t)}</p>
                    <p className="task-row__meta">Last: {lastDoneText(lastInterventionOfTask(interventions, t.id))}</p>
                  </div>
                  <div className="task-row__actions">
                    <button className="btn btn--small" onClick={() => onDone(t)}>Done</button>
                    <button className="btn btn--small" onClick={() => onEdit(t)}>Edit</button>
                    <button className="btn btn--small btn--danger" onClick={() => onDelete(t)}>Del</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
    </>
  )
}

interface HistoryTabProps {
  /** The equipment's interventions; the tab lists them newest first. */
  interventions: InterventionRow[]
  /** Every task, to name each intervention's. */
  allTasks: TaskRow[]
  onLog: () => void
  onEdit: (intervention: InterventionRow) => void
  onDelete: (intervention: InterventionRow) => void
}

/** The History tab: "+ Log intervention", then the equipment's interventions with Edit and Del. */
function HistoryTab({ interventions, allTasks, onLog, onEdit, onDelete }: HistoryTabProps) {
  const sorted = newestFirst(interventions)
  return (
    <>
      <div className="tab-toolbar">
        <h2>History</h2>
        <button className="btn btn--accent" onClick={onLog}>+ Log intervention</button>
      </div>
      {sorted.length === 0
        ? <p className="page__empty">No history yet for this equipment.</p>
        : (
          <HistoryList
            interventions={sorted}
            taskHeading="Task"
            labelOf={inv => interventionTaskLabel(inv, allTasks)}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
    </>
  )
}

interface DocumentsTabProps {
  documents: FileRow[]
  loaded: boolean
  error: string | null
  uploading: boolean
  uploadError: string | null
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void
  onDelete: (file: FileRow) => void
}

/**
 * The Documents tab: "+ Upload document", then each file with its size, its
 * upload date, Download and Delete. A file gone from the server says so and
 * has no Download (#122).
 */
function DocumentsTab({ documents, loaded, error, uploading, uploadError, onUpload, onDelete }: DocumentsTabProps) {
  let list: ReactNode
  if (!loaded) list = <p className="page__empty">Loading...</p>
  else if (error) list = <div className="flash flash--error">{error}</div>
  else if (documents.length === 0) {
    list = (
      <p className="page__empty">No documents attached.{' '}
        <label className="upload-inline">+ Upload your first document<input type="file" style={{ display: 'none' }} onChange={onUpload} /></label>
      </p>
    )
  } else {
    list = (
      <div className="doc-list">
        {documents.map(f => (
          <div key={f.name} className="doc-row">
            <div className="doc-row__info">
              <p className="doc-row__name">{f.originalName}</p>
              <p className={documentMetaClassName(f)}>{documentMetaText(f)}</p>
            </div>
            <div className="doc-row__actions">
              {!f.missing && <a className="btn btn--small" href={f.url} download={f.originalName}>Download</a>}
              <button className="btn btn--small btn--danger" onClick={() => onDelete(f)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="tab-toolbar">
        <h2>Documents</h2>
        <label className="btn btn--accent">
          {uploading ? 'Uploading...' : '+ Upload document'}
          <input type="file" style={{ display: 'none' }} onChange={onUpload} disabled={uploading} />
        </label>
      </div>
      {uploadError && <div className="flash flash--error">{uploadError}</div>}
      {list}
    </>
  )
}

/** The Info tab: the equipment's metadata, read-only; the edit form changes it. */
function InfoTab({ equipment: eq }: { equipment: EquipmentRow }) {
  return (
    <div className="info-tab">
      <div className="form-field">
        <label className="form-field__label">Name</label>
        <p>{eq.name}</p>
      </div>
      <div className="form-field">
        <label className="form-field__label">Description</label>
        <p>{descriptionText(eq)}</p>
      </div>
      <div className="form-field">
        <label className="form-field__label">Icon</label>
        <p>{shownIcon(eq.icon)} <span className="form-field__hint">— shown in lists and the dashboard</span></p>
      </div>
      {eq.commissionedAt ? (
        <div className="form-field">
          <label className="form-field__label">Date of commissioning</label>
          <p>{formatCalendarDate(eq.commissionedAt)}</p>
        </div>
      ) : null}
      {isDecommissioned(eq) && (
        <div className="form-field">
          <label className="form-field__label">Date of decommissioning</label>
          <p>{formatCalendarDate(eq.decommissionedAt)}</p>
        </div>
      )}
      <div className="toggle-row">
        <span className="toggle-row__label">Hour-meter tracking</span>
        <span>{hourMeterText(eq)}</span>
      </div>
      {eq.tracksHours && (
        <div className="form-field">
          <label className="form-field__label">Current hours</label>
          <p>{formatHours(eq.hours)}</p>
        </div>
      )}
      <div className="form-field">
        <label className="form-field__label">Created</label>
        <p>{formatTimestampDate(eq.createdAt)}</p>
      </div>
    </div>
  )
}

// ── Modals ──

interface TaskFormModalProps {
  equipmentId: number
  /** The task to edit; none for Add task. */
  task?: TaskRow
  /** Whether the task has an intervention: an expiry task's form then no longer asks for its current expiry date. */
  hasIntervention: boolean
  /** The hours interval shows only on an equipment that tracks hours. */
  tracksHours: boolean
  onClose: () => void
  /** Called once saved; the page closes the form and reloads. */
  onSaved: () => void | Promise<void>
}

/**
 * Add task and Edit task (doc/gui/tasks.md, "Task form"). Add task offers the
 * kind; Edit task shows it as text, since it cannot change. The form starts
 * from the task, or empty, each time it opens: its state is
 * its own, dropped when it closes. It saves through saveTask, and stays open
 * with the reason when the save fails.
 */
function TaskFormModal({ equipmentId, task, hasIntervention, tracksHours, onClose, onSaved }: TaskFormModalProps) {
  const isNew = task == null
  const [form, setForm] = useState<TaskFormValues>(() => (task ? taskFormOf(task) : newTaskForm()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (fields: Partial<TaskFormValues>) => setForm({ ...form, ...fields })

  async function onSave() {
    if (saving || !canSaveTask(form)) return
    setSaving(true)
    setError(null)
    const failure = await saveTask(form, { equipmentId, taskId: task?.id ?? null }, taskApi)
    if (failure !== null) {
      setError(failure)
      setSaving(false)
      return
    }
    await onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h2 className="modal__title">{isNew ? 'Add task' : 'Edit task'}</h2>
        {error && <div className="flash flash--error">{error}</div>}
        <div className="form-field">
          <label className="form-field__label">Name *</label>
          <input placeholder="e.g. Oil change" value={form.name} onChange={e => set({ name: e.target.value })} />
        </div>
        <div className="form-field">
          <label className="form-field__label">Description</label>
          <textarea placeholder="Optional" value={form.description} onChange={e => set({ description: e.target.value })}></textarea>
        </div>
        {isNew
          ? (
            <fieldset className="form-field form-field--inline task-kind">
              <legend className="form-field__label">Kind</legend>
              <label className="form-field__checkbox-label">
                <input type="radio" name="task-kind" value="interval" checked={form.kind === 'interval'} onChange={() => set({ kind: 'interval' })} /> Interval
              </label>
              <label className="form-field__checkbox-label">
                <input type="radio" name="task-kind" value="expiry" checked={form.kind === 'expiry'} onChange={() => set({ kind: 'expiry' })} /> Expiry date
              </label>
            </fieldset>
          )
          : <p className="form-field__hint">{taskKindText(form.kind)}</p>}
        {asksCurrentExpiryDate(form, hasIntervention) && (
          <div className="form-field">
            <label className="form-field__label">Current expiry date</label>
            <input type="date" aria-label="Current expiry date" value={form.currentExpiryDate} onChange={e => set({ currentExpiryDate: e.target.value })} />
            <p className="form-field__hint">The date printed on the part fitted now. Leave empty if unknown.</p>
          </div>
        )}
        {form.kind !== 'expiry' && (
          <div>
            {tracksHours && (
              <div className="form-field">
                <label className="form-field__label">Hours interval</label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 100"
                  value={intervalValue(form.hoursInterval)}
                  onChange={e => set({ hoursInterval: intervalFromInput(e.target.value) })}
                />
              </div>
            )}
            <div className="form-field">
              <label className="form-field__label">Months interval</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 6"
                value={intervalValue(form.monthsInterval)}
                onChange={e => set({ monthsInterval: intervalFromInput(e.target.value) })}
              />
            </div>
          </div>
        )}
        <div className="modal__actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--accent" onClick={onSave} disabled={saving || !canSaveTask(form)}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface DeleteTaskModalProps {
  task: TaskRow
  onCancel: () => void
  /** Called once deleted; the page closes the confirmation and reloads. */
  onDeleted: () => void | Promise<void>
}

/** The confirmation before a task is deleted, with its interventions (doc/gui/tasks.md, "Flow: Delete a task"). */
function DeleteTaskModal({ task, onCancel, onDeleted }: DeleteTaskModalProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDelete() {
    if (deleting || task.id == null) return
    setDeleting(true)
    setError(null)
    const failure = await deleteTask(task.id, taskApi)
    if (failure !== null) {
      setError(failure)
      setDeleting(false)
      return
    }
    await onDeleted()
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal">
        <h2 className="modal__title">Delete task</h2>
        {error && <div className="flash flash--error">{error}</div>}
        <p className="confirm-text">Are you sure you want to delete <strong>{task.name ?? ''}</strong>? All interventions recorded for this task will also be deleted.</p>
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

interface DeleteDocumentModalProps {
  equipmentId: number
  file: FileRow
  onCancel: () => void
  /** Called once deleted; the page closes the confirmation and reloads the documents. */
  onDeleted: () => void | Promise<void>
}

/** The confirmation before a document is deleted (doc/gui/equipments.md, "Flow: Delete a document"). */
function DeleteDocumentModal({ equipmentId, file, onCancel, onDeleted }: DeleteDocumentModalProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDelete() {
    if (deleting || !file.name) return
    setDeleting(true)
    setError(null)
    const failure = await deleteDocument(equipmentId, file.name, equipmentApi)
    if (failure !== null) {
      setError(failure)
      setDeleting(false)
      return
    }
    await onDeleted()
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal">
        <h2 className="modal__title">Delete file</h2>
        {error && <div className="flash flash--error">{error}</div>}
        <p className="confirm-text">Delete <strong>{file.originalName}</strong>? This cannot be undone.</p>
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
