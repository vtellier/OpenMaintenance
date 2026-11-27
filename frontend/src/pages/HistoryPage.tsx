import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { EquipmentApi, GroupApi, InterventionApi, TaskApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { DeleteInterventionModal } from '@/components/DeleteInterventionModal'
import { FullInterventionModal } from '@/components/FullInterventionModal'
import { HistoryList } from '@/components/HistoryList'
import { ReadingDoubtModal } from '@/components/ReadingDoubtModal'
import type { CalendarDate } from '@/lib/calendar-date'
import { equipmentLabel } from '@/lib/decommissioning'
import { byName, groupOptionLabel } from '@/lib/equipmentGroups'
import type { HistoryFilter } from '@/lib/equipmentGroups'
import { filterValue, historyEmptyText, historyItemLabel, historyList, parseFilterValue } from '@/lib/history'
import type { InterventionFormSource } from '@/lib/interventionForm'
import { stillInDoubt } from '@/lib/readingDoubt'
import type { ReadingDoubt } from '@/lib/readingDoubt'
import { toEquipmentRow, toGroupRow, toInterventionRow, toTaskRow } from '@/lib/rows'
import type { EquipmentRow, GroupRow, InterventionRow, TaskRow } from '@/lib/rows'

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)
const interventionApi = new InterventionApi(apiConfig)
const groupApi = new GroupApi(apiConfig)

/**
 * History: every intervention, newest first, with the equipment (or group)
 * and date filters, "+ Log intervention", and Edit and Delete on each row
 * (doc/gui/history.md).
 */
export function HistoryPage() {
  const [equipments, setEquipments] = useState<EquipmentRow[]>([])
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [interventions, setInterventions] = useState<InterventionRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [filter, setFilter] = useState<HistoryFilter>(null)
  const [filterDateFrom, setFilterDateFrom] = useState<CalendarDate | ''>('')
  const [filterDateTo, setFilterDateTo] = useState<CalendarDate | ''>('')

  // What the intervention form is open for; null while it is closed.
  const [formSource, setFormSource] = useState<InterventionFormSource | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InterventionRow | null>(null)
  // The question about the reading a delete or an edit may have set.
  const [doubt, setDoubt] = useState<ReadingDoubt | null>(null)

  // Resolves to the equipments loaded, or null when the load failed or was
  // aborted. As on pre-react, a later success leaves a load error in place.
  const reload = useCallback(async (signal?: AbortSignal): Promise<EquipmentRow[] | null> => {
    let fresh: EquipmentRow[] | null = null
    try {
      const [eqs, ts, invs, gs] = await Promise.all([
        equipmentApi.listEquipments({ signal }),
        taskApi.listTasks({ signal }),
        interventionApi.listInterventions({ signal }),
        groupApi.listGroups({ signal }),
      ])
      if (signal?.aborted) return null
      fresh = eqs.map(toEquipmentRow)
      setGroups(gs.map(toGroupRow))
      setEquipments(fresh)
      setTasks(ts.map(toTaskRow))
      setInterventions(invs.map(toInterventionRow))
    } catch {
      if (signal?.aborted) return null
      setLoadError('Failed to load history')
    }
    setLoaded(true)
    return fresh
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    reload(controller.signal)
    return () => controller.abort()
  }, [reload])

  // Once a change is saved: reload, then ask about the reading it may have
  // left in doubt, against the reloaded equipments (the ones held before, if
  // the reload failed).
  async function reloadAndAsk(before: ReadingDoubt | null) {
    const fresh = await reload()
    setDoubt(stillInDoubt(before, fresh ?? equipments))
  }

  async function onFormSaved(before: ReadingDoubt | null) {
    setFormSource(null)
    await reloadAndAsk(before)
  }

  async function onDeleted(before: ReadingDoubt | null) {
    setDeleteTarget(null)
    await reloadAndAsk(before)
  }

  let listContent: ReactNode = null
  if (loaded && !loadError) {
    const list = historyList(interventions, { filter, from: filterDateFrom, to: filterDateTo }, equipments, tasks)
    listContent = list.length === 0
      ? <p className="page__empty">{historyEmptyText(equipments.length)}</p>
      : (
        <HistoryList
          interventions={list}
          taskHeading="Equipment / Task"
          labelOf={inv => historyItemLabel(inv, equipments, tasks)}
          onEdit={inv => setFormSource({ edit: inv })}
          onDelete={setDeleteTarget}
        />
      )
  }

  return (
    <section className="page">
      <div className="page__header">
        <h1>History</h1>
        <button className="btn btn--accent" onClick={() => setFormSource({ new: { equipmentId: null } })}>+ Log intervention</button>
      </div>

      <div className="history-body">
        <div className="history-filters">
          <div className="form-field">
            <select aria-label="Equipment" value={filterValue(filter)} onChange={e => setFilter(parseFilterValue(e.target.value))}>
              <option value="">All equipments</option>
              {groups.length > 0 && (
                <optgroup label="Groups">
                  {[...groups].sort(byName).map(g => (
                    <option key={g.id} value={filterValue({ groupId: g.id! })}>{groupOptionLabel(g)}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Equipments">
                {[...equipments].sort(byName).map(eq => (
                  // A decommissioned equipment is still listed, marked.
                  <option key={eq.id} value={filterValue({ equipmentId: eq.id! })}>{equipmentLabel(eq)}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="form-field">
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} placeholder="From" />
          </div>
          <div className="form-field">
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} placeholder="To" />
          </div>
        </div>
        {!loaded && <p className="page__empty">Loading...</p>}
        {loadError && <div className="flash flash--error">{loadError}</div>}
        {listContent}
      </div>

      {formSource && (
        <FullInterventionModal
          source={formSource}
          equipments={equipments}
          tasks={tasks}
          interventions={interventions}
          onClose={() => setFormSource(null)}
          onSaved={onFormSaved}
        />
      )}
      {doubt && <ReadingDoubtModal doubt={doubt} onKeep={() => setDoubt(null)} />}
      {deleteTarget && (
        <DeleteInterventionModal
          intervention={deleteTarget}
          context={{ equipments, tasks, interventions }}
          onCancel={() => setDeleteTarget(null)}
          onDeleted={onDeleted}
        />
      )}
    </section>
  )
}
