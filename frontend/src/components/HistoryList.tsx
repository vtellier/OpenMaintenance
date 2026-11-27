import { formatCalendarDate } from '@/lib/calendar-date'
import { buildInterventionMeta } from '@/lib/format'
import type { InterventionRow } from '@/lib/rows'

export interface HistoryListProps {
  /** The rows, in the order to list them (newest first). */
  interventions: InterventionRow[]
  /** The second column's heading: "Equipment / Task" on History, "Task" on an equipment's History tab. */
  taskHeading: string
  /** The second column of a row: historyItemLabel on History, interventionTaskLabel on an equipment's tab. */
  labelOf: (intervention: InterventionRow) => string
  onEdit: (intervention: InterventionRow) => void
  onDelete: (intervention: InterventionRow) => void
}

/**
 * A list of interventions with Edit and Del on each row: the global History
 * screen and an equipment's History tab (doc/gui/history.md). `style.css`
 * makes it a table on a wide screen and cards on a phone; a row's full
 * details show on hover (its `title`).
 */
export function HistoryList({ interventions, taskHeading, labelOf, onEdit, onDelete }: HistoryListProps) {
  return (
    <div className="history-list">
      <div className="history-header">
        <span className="history-item__date">Date</span>
        <span className="history-item__task">{taskHeading}</span>
        <span className="history-item__meta">Details</span>
        <span className="history-item__actions-head"></span>
      </div>
      {interventions.map(inv => {
        const meta = buildInterventionMeta(inv)
        return (
          <div key={inv.id} className="history-item">
            <span className="history-item__date">{formatCalendarDate(inv.date)}</span>
            <span className="history-item__task">{labelOf(inv)}</span>
            <span className="history-item__meta" title={meta}>{meta}</span>
            <div className="history-item__actions">
              <button className="btn btn--small" onClick={() => onEdit(inv)}>Edit</button>
              <button className="btn btn--small btn--danger" onClick={() => onDelete(inv)}>Del</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
