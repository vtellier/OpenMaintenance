import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { EquipmentApi, InterventionApi, TaskApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { EquipmentAvatar } from '@/components/EquipmentAvatar'
import { FullInterventionModal } from '@/components/FullInterventionModal'
import { dueLine, dueTaskBlocks } from '@/lib/dashboard'
import type { DueTaskBlock } from '@/lib/dashboard'
import { formatHours } from '@/lib/format'
import { bannerRowClasses, freshnessBanner, sameHoursReading, saveSameHours } from '@/lib/hourMeterFreshness'
import { toEquipmentRow, toInterventionRow, toTaskRow } from '@/lib/rows'
import type { EquipmentRow, InterventionRow, TaskRow } from '@/lib/rows'
import { relativeTime } from '@/lib/timestamp'

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)
const interventionApi = new InterventionApi(apiConfig)

/**
 * The Dashboard: the hour-meter freshness banner, then the overdue and due
 * soon tasks grouped by equipment, each with Done (doc/gui/dashboard.md).
 */
export function DashboardPage() {
  const [equipments, setEquipments] = useState<EquipmentRow[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [interventions, setInterventions] = useState<InterventionRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  // The task Done opened the intervention form for; null while it is closed.
  const [doneTaskId, setDoneTaskId] = useState<number | null>(null)
  const [sameHoursSavingId, setSameHoursSavingId] = useState<number | null>(null)

  // As on pre-react, a later success leaves a load error in place.
  const reload = useCallback(async (signal?: AbortSignal) => {
    try {
      const [eqs, ts, invs] = await Promise.all([
        equipmentApi.listEquipments({ signal }),
        taskApi.listTasks({ signal }),
        interventionApi.listInterventions({ signal }),
      ])
      if (signal?.aborted) return
      setEquipments(eqs.map(toEquipmentRow))
      setTasks(ts.map(toTaskRow))
      setInterventions(invs.map(toInterventionRow))
    } catch {
      if (signal?.aborted) return
      setLoadError('Failed to load data')
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    reload(controller.signal)
    return () => controller.abort()
  }, [reload])

  async function confirmSameHours(eq: EquipmentRow) {
    if (eq.id == null || sameHoursReading(eq) == null || sameHoursSavingId != null) return
    setSameHoursSavingId(eq.id)
    const failure = await saveSameHours(eq, equipmentApi)
    if (failure === null) await reload()
    else setLoadError(failure)
    setSameHoursSavingId(null)
  }

  // A new log never leaves the reading in doubt: nothing to ask.
  async function onDoneFormSaved() {
    setDoneTaskId(null)
    await reload()
  }

  let content: ReactNode
  if (!loaded) content = <p className="page__empty">Loading...</p>
  else if (loadError) content = <div className="flash flash--error">{loadError}</div>
  else {
    const { stale, fresh } = freshnessBanner(equipments)
    const blocks = dueTaskBlocks(tasks)
    const rowProps = { savingId: sameHoursSavingId, onSameHours: confirmSameHours }

    let dueTasks: ReactNode
    if (blocks.length > 0) {
      dueTasks = (
        <div className="dashboard-tasks">
          {blocks.map(block => (
            <EquipmentBlock key={block.equipmentId} block={block} equipments={equipments} onDone={setDoneTaskId} />
          ))}
        </div>
      )
    } else if (equipments.length === 0) {
      dueTasks = (
        <p className="page__empty">
          You're all caught up. Nothing due right now.<br />
          <a href="/equipments" className="btn" style={{ marginTop: '12px', display: 'inline-flex' }}>Add your first equipment</a>
        </p>
      )
    } else {
      dueTasks = <p className="page__empty">You're all caught up. Nothing due right now.</p>
    }

    content = (
      <>
        {stale.length + fresh.length > 0 && (
          <div className="hours-banner">
            <div className="hours-banner__header">
              <span className="hours-banner__title">Keep your hour-meters fresh</span>
            </div>
            <div className="hours-banner__list">
              {stale.map(eq => <BannerRow key={eq.id} eq={eq} {...rowProps} />)}
              {fresh.length > 0 && (
                <details className="hours-banner__fresh">
                  <summary className="hours-banner__summary">{fresh.length} fresh (show/hide)</summary>
                  {fresh.map(eq => <BannerRow key={eq.id} eq={eq} {...rowProps} />)}
                </details>
              )}
            </div>
          </div>
        )}
        {dueTasks}
      </>
    )
  }

  return (
    <section className="page">
      <h1>Dashboard</h1>
      {content}
      {doneTaskId != null && (
        <FullInterventionModal
          source={{ done: { taskId: doneTaskId } }}
          equipments={equipments}
          tasks={tasks}
          interventions={interventions}
          onClose={() => setDoneTaskId(null)}
          onSaved={onDoneFormSaved}
        />
      )}
    </section>
  )
}

interface BannerRowProps {
  eq: EquipmentRow
  /** The equipment whose "Same hours" is saving, if any. */
  savingId: number | null
  onSameHours: (eq: EquipmentRow) => void
}

/** One equipment of the freshness banner, stale or fresh. */
function BannerRow({ eq, savingId, onSameHours }: BannerRowProps) {
  const classes = bannerRowClasses(eq)
  const saving = savingId === eq.id
  return (
    <div className={classes.row}>
      <a href={'/equipments/' + eq.id} className="hours-banner__eq-name">{eq.name}</a>
      <span className="hours-banner__hours">{formatHours(eq.hours)}</span>
      <span className={classes.updated}>updated {relativeTime(eq.hoursUpdatedAt)}</span>
      {/* No reading yet: nothing to confirm, so only Update is offered. */}
      {sameHoursReading(eq) != null && (
        <button className="btn btn--small btn--ghost" onClick={() => onSameHours(eq)} disabled={saving}>{saving ? '...' : 'Same hours'}</button>
      )}
      <a href={'/equipments/' + eq.id + '/edit/hours'} className="btn btn--small">Update</a>
    </div>
  )
}

interface EquipmentBlockProps {
  block: DueTaskBlock<TaskRow>
  equipments: EquipmentRow[]
  onDone: (taskId: number) => void
}

/** An equipment's due tasks, most urgent first, each with Done. */
function EquipmentBlock({ block, equipments, onDone }: EquipmentBlockProps) {
  const eq = equipments.find(e => e.id === block.equipmentId)
  if (!eq) {
    console.warn(`DashboardPage: tasks reference unknown equipment ${block.equipmentId}`)
    return null
  }
  return (
    <div className="equipment-block">
      <div className="equipment-block__header">
        <a href={'/equipments/' + block.equipmentId} className="equipment-block__name"><EquipmentAvatar icon={eq.icon} /><span>{eq.name}</span></a>
        {eq.tracksHours && <span className="equipment-block__hours">{formatHours(eq.hours)}</span>}
      </div>
      <div className="task-list-compact">
        {block.tasks.map(t => {
          const line = dueLine(t)
          return (
            <div key={t.id} className="task-row">
              <div className="task-row__info">
                <p className="task-row__name">{t.name}</p>
                <p className="task-row__meta"><span className={line.className}>{line.text}</span></p>
              </div>
              <div className="task-row__actions">
                <button className="btn btn--small" onClick={() => { if (t.id != null) onDone(t.id) }}>Done</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
