import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { EquipmentApi, GroupApi, InterventionApi, TaskApi } from '@generated/api'
import { apiConfig } from '@/api/config'
import { EquipmentAvatar } from '@/components/EquipmentAvatar'
import { GroupPicker } from '@/components/GroupPicker'
import { IconPicker } from '@/components/IconPicker'
import { formatCalendarDate } from '@/lib/calendar-date'
import { decommissionedCount, isDecommissioned } from '@/lib/decommissioning'
import { cardClassName, cardHoursClassName, cardStatusLine, lastInterventionText, tasksByEquipment } from '@/lib/equipmentCard'
import { canAddEquipment, newEquipmentForm, saveNewEquipment, shownIcon } from '@/lib/equipmentForm'
import type { NewEquipmentValues } from '@/lib/equipmentForm'
import { DEFAULT_GROUP_ICON, emptyGroupText, equipmentList, groupStatus, listBlocks, statusBadge } from '@/lib/equipmentGroups'
import {
  isCollapsed, readCollapsed, readShowDecommissioned, toggleCollapsed, writeCollapsed, writeShowDecommissioned,
} from '@/lib/equipmentsListPrefs'
import type { CollapsedGroups } from '@/lib/equipmentsListPrefs'
import { formatHours } from '@/lib/format'
import { canRenameGroup, changeGroupIcon, deleteGroup, deleteGroupText, iconUnchanged, renameGroup } from '@/lib/groupForm'
import { hoursFromInput } from '@/lib/hoursForm'
import { latestEquipmentIntervention } from '@/lib/interventions'
import { toEquipmentRow, toGroupRow, toInterventionRow, toTaskRow } from '@/lib/rows'
import type { EquipmentRow, GroupRow, InterventionRow, TaskRow } from '@/lib/rows'
import { relativeTime } from '@/lib/timestamp'

const equipmentApi = new EquipmentApi(apiConfig)
const taskApi = new TaskApi(apiConfig)
const interventionApi = new InterventionApi(apiConfig)
const groupApi = new GroupApi(apiConfig)

/**
 * The Equipments list: group sections and ungrouped cards, "Show
 * decommissioned", "+ Add equipment", and each group's menu (Rename, Change
 * icon, Delete) (doc/gui/equipments.md, "Equipments list").
 */
export function EquipmentsPage() {
  const [equipments, setEquipments] = useState<EquipmentRow[]>([])
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [tasksOf, setTasksOf] = useState<Record<number, TaskRow[]>>({})
  const [interventions, setInterventions] = useState<InterventionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // The Add equipment form lives here, not in its modal: as on pre-react,
  // Cancel keeps what was typed for the next open; a save empties it.
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState<NewEquipmentValues>(newEquipmentForm)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Remembered per browser (equipmentsListPrefs.ts).
  const [collapsed, setCollapsed] = useState<CollapsedGroups>(readCollapsed)
  const [showDecommissioned, setShowDecommissioned] = useState<boolean>(readShowDecommissioned)
  const [menuGroupId, setMenuGroupId] = useState<number | null>(null)

  const [renameTarget, setRenameTarget] = useState<GroupRow | null>(null)
  const [renameName, setRenameName] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<GroupRow | null>(null)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [groupError, setGroupError] = useState<string | null>(null)

  // As on pre-react, every load, a reload included, shows "Loading
  // equipments..." in place of the list until it is done.
  const reload = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const [eqs, ts, invs, gs] = await Promise.all([
        equipmentApi.listEquipments({ signal }),
        taskApi.listTasks({ signal }),
        interventionApi.listInterventions({ signal }),
        groupApi.listGroups({ signal }),
      ])
      if (signal?.aborted) return
      setGroups(gs.map(toGroupRow))
      setEquipments(eqs.map(toEquipmentRow))
      setInterventions(invs.map(toInterventionRow))
      setTasksOf(tasksByEquipment(ts.map(toTaskRow)))
    } catch {
      if (signal?.aborted) return
      setError('Failed to load equipments')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    reload(controller.signal)
    return () => controller.abort()
  }, [reload])

  async function onSaveAdd() {
    if (adding || !canAddEquipment(addForm)) return
    setAdding(true)
    setAddError(null)
    const failure = await saveNewEquipment(addForm, equipmentApi)
    if (failure !== null) {
      setAddError(failure)
      setAdding(false)
      return
    }
    setShowAddModal(false)
    setAddForm(newEquipmentForm())
    await reload()
    setAdding(false)
  }

  function onToggleShowDecommissioned() {
    const next = !showDecommissioned
    setShowDecommissioned(next)
    writeShowDecommissioned(next)
  }

  function toggleGroup(groupId: number) {
    const next = toggleCollapsed(collapsed, groupId)
    setCollapsed(next)
    writeCollapsed(next)
  }

  function openRename(group: GroupRow) {
    setMenuGroupId(null)
    setRenameTarget(group)
    setRenameName(group.name ?? '')
    setRenameError(null)
  }

  async function onConfirmRename() {
    if (!renameTarget || renameSaving || !canRenameGroup(renameName)) return
    setRenameSaving(true)
    setRenameError(null)
    const failure = await renameGroup(renameTarget, renameName, groupApi)
    if (failure === null) {
      setRenameTarget(null)
      await reload()
    } else {
      setRenameError(failure)
    }
    setRenameSaving(false)
  }

  async function changeIcon(group: GroupRow, icon: string) {
    setMenuGroupId(null)
    if (iconUnchanged(group, icon)) return
    setGroupError(null)
    const failure = await changeGroupIcon(group, icon, groupApi)
    if (failure === null) await reload()
    else setGroupError(failure)
  }

  function openDelete(group: GroupRow) {
    setMenuGroupId(null)
    setDeleteTarget(group)
    setDeleteError(null)
  }

  async function onConfirmDeleteGroup() {
    if (!deleteTarget || deleteSaving) return
    setDeleteSaving(true)
    setDeleteError(null)
    const failure = await deleteGroup(deleteTarget, groupApi)
    if (failure === null) {
      setDeleteTarget(null)
      await reload()
    } else {
      setDeleteError(failure)
    }
    setDeleteSaving(false)
  }

  function onAddClick() {
    setShowAddModal(true)
  }

  const decommissioned = decommissionedCount(equipments)

  return (
    <section className="page">
      <div className="page__header">
        <h1>Equipments</h1>
        <div className="page__header-actions">
          {decommissioned > 0 && (
            <label className="form-field__checkbox-label">
              <input type="checkbox" checked={showDecommissioned} onChange={onToggleShowDecommissioned} /> Show decommissioned ({decommissioned})
            </label>
          )}
          <button className="btn btn--accent" onClick={onAddClick}>+ Add equipment</button>
        </div>
      </div>

      {loading && <p className="page__empty">Loading equipments...</p>}

      {error && <div className="flash flash--error">{error}</div>}

      {groupError && <div className="flash flash--error">{groupError}</div>}

      {!loading && !error && equipments.length === 0 && groups.length === 0 && (
        <p className="page__empty">No equipments yet. <a href="#" onClick={onAddClick}>Add your first equipment</a>.</p>
      )}

      {!loading && (equipments.length > 0 || groups.length > 0) && (
        <EquipmentList
          groups={groups}
          equipments={equipments}
          tasksOf={tasksOf}
          interventions={interventions}
          showDecommissioned={showDecommissioned}
          collapsed={collapsed}
          menuGroupId={menuGroupId}
          onToggleGroup={toggleGroup}
          onToggleMenu={groupId => setMenuGroupId(id => id === groupId ? null : groupId)}
          onCloseMenu={() => setMenuGroupId(null)}
          onRename={openRename}
          onChangeIcon={changeIcon}
          onDelete={openDelete}
        />
      )}

      {showAddModal && (
        <AddEquipmentModal
          form={addForm}
          groups={groups}
          error={addError}
          adding={adding}
          onChange={setAddForm}
          onGroupCreated={g => setGroups(gs => [...gs, g])}
          onCancel={() => setShowAddModal(false)}
          onSave={onSaveAdd}
        />
      )}
      {renameTarget && (
        <RenameGroupModal
          name={renameName}
          error={renameError}
          saving={renameSaving}
          onChange={setRenameName}
          onCancel={() => setRenameTarget(null)}
          onSave={onConfirmRename}
        />
      )}
      {deleteTarget && (
        <DeleteGroupModal
          text={deleteGroupText(deleteTarget, equipments)}
          error={deleteError}
          deleting={deleteSaving}
          onCancel={() => setDeleteTarget(null)}
          onDelete={onConfirmDeleteGroup}
        />
      )}

      <button className="fab" aria-label="Add equipment" onClick={onAddClick}>+</button>
    </section>
  )
}

/** The actions of a group's section header. */
interface GroupActions {
  onToggleGroup: (groupId: number) => void
  onToggleMenu: (groupId: number) => void
  onCloseMenu: () => void
  onRename: (group: GroupRow) => void
  onChangeIcon: (group: GroupRow, icon: string) => void
  onDelete: (group: GroupRow) => void
}

interface EquipmentListProps extends GroupActions {
  groups: GroupRow[]
  equipments: EquipmentRow[]
  tasksOf: Record<number, TaskRow[]>
  interventions: InterventionRow[]
  showDecommissioned: boolean
  collapsed: CollapsedGroups
  menuGroupId: number | null
}

/**
 * The list: group sections and runs of ungrouped cards, sorted together
 * (equipmentList), each run in one grid between the sections (listBlocks).
 */
function EquipmentList({ groups, equipments, tasksOf, interventions, showDecommissioned, collapsed, menuGroupId, ...actions }: EquipmentListProps) {
  const entries = equipmentList(groups, equipments, { showDecommissioned })
  if (entries.length === 0) return <p className="page__empty">No equipments in service.</p>
  const cards = (list: EquipmentRow[]) => list.map(eq => (
    <EquipmentCard key={eq.id} eq={eq} tasks={tasksOf[eq.id!] || []} interventions={interventions} />
  ))

  return (
    <div className="equipment-list">
      {listBlocks(entries).map(block => block.kind === 'cards'
        ? <div key={'cards-' + block.equipments[0].id} className="equipment-grid">{cards(block.equipments)}</div>
        : (
          <GroupSection
            key={'group-' + block.group.id}
            group={block.group}
            hidden={block.hidden}
            status={groupStatus(block.equipments.map(eq => tasksOf[eq.id!] || []))}
            count={block.equipments.length}
            collapsed={isCollapsed(collapsed, block.group.id!)}
            menuOpen={menuGroupId === block.group.id}
            {...actions}
          >
            {cards(block.equipments)}
          </GroupSection>
        ))}
    </div>
  )
}

interface GroupSectionProps extends GroupActions {
  group: GroupRow
  /** How many of its equipments are decommissioned and not shown. */
  hidden: number
  /** The worst status among its equipments (groupStatus), for the header's badge. */
  status: ReturnType<typeof groupStatus>
  /** How many of its equipments the section shows. */
  count: number
  collapsed: boolean
  menuOpen: boolean
  /** Its cards. */
  children: ReactNode
}

/** A group's collapsible section: its header, with its menu, then its cards. */
function GroupSection({
  group, hidden, status, count, collapsed, menuOpen, children, onToggleGroup, onToggleMenu, onCloseMenu, onRename, onChangeIcon, onDelete,
}: GroupSectionProps) {
  const groupId = group.id!
  const badge = status ? statusBadge(status) : null
  const icon = shownIcon(group.icon, DEFAULT_GROUP_ICON)

  return (
    <section className="equipment-group">
      <div className="equipment-group__header">
        <button type="button" className="equipment-group__toggle" aria-expanded={!collapsed} onClick={() => onToggleGroup(groupId)}>
          <span className="equipment-group__chevron" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
          <EquipmentAvatar icon={icon} />
          <span className="equipment-group__name">{group.name}</span>
          <span className="equipment-group__count">{'· ' + count}</span>
          {badge && <span className={badge.className}>{badge.label}</span>}
        </button>
        <div className="equipment-group__menu">
          <button type="button" className="btn btn--small" aria-label="Group actions" title="Group actions" onClick={() => onToggleMenu(groupId)}>{'⋯'}</button>
          {menuOpen && (
            <>
              <div className="menu__backdrop" onClick={onCloseMenu}></div>
              <div className="menu">
                <button type="button" className="menu__item" onClick={() => onRename(group)}>Rename</button>
                <IconPicker current={icon} onSelect={v => onChangeIcon(group, v)} variant="menuitem" defaultIcon={DEFAULT_GROUP_ICON} />
                <button type="button" className="menu__item menu__item--danger" onClick={() => onDelete(group)}>Delete</button>
              </div>
            </>
          )}
        </div>
      </div>
      {!collapsed && (count > 0
        ? <div className="equipment-grid">{children}</div>
        : <p className="equipment-group__empty">{emptyGroupText(hidden)}</p>)}
    </section>
  )
}

interface EquipmentCardProps {
  eq: EquipmentRow
  /** The equipment's tasks. */
  tasks: TaskRow[]
  /** Every intervention; the card finds its latest. */
  interventions: InterventionRow[]
}

/** An equipment's card (doc/gui/equipments.md, "Card content"); it opens the detail. */
function EquipmentCard({ eq, tasks, interventions }: EquipmentCardProps) {
  // The badge follows the shared rule, which the section headers use too.
  const statusLine = cardStatusLine(tasks)
  const badge = statusLine ? statusBadge(statusLine.status) : null

  return (
    <a href={'/equipments/' + eq.id} className={cardClassName(eq)}>
      <div className="equipment-card__head">
        <EquipmentAvatar icon={eq.icon} />
        <p className="equipment-card__title">{eq.name}</p>
      </div>
      {eq.description ? <p className="equipment-card__desc">{eq.description}</p> : null}
      {eq.tracksHours && (
        <div className="equipment-card__hours">
          <span>{formatHours(eq.hours)}</span>
          <span className={cardHoursClassName(eq)}>{'• ' + relativeTime(eq.hoursUpdatedAt)}</span>
        </div>
      )}
      <div className="equipment-card__meta">{lastInterventionText(latestEquipmentIntervention(interventions, tasks), tasks)}</div>
      {isDecommissioned(eq) && (
        <div className="equipment-card__due">
          <span className="due-indicator due-indicator--decommissioned">Decommissioned</span> {formatCalendarDate(eq.decommissionedAt)}
        </div>
      )}
      {badge && statusLine && (
        <div className="equipment-card__due">
          <span className={badge.className}>{badge.label}</span> {statusLine.text}
        </div>
      )}
    </a>
  )
}

interface AddEquipmentModalProps {
  form: NewEquipmentValues
  groups: GroupRow[]
  error: string | null
  adding: boolean
  onChange: (form: NewEquipmentValues) => void
  onGroupCreated: (group: GroupRow) => void
  onCancel: () => void
  onSave: () => void
}

/** "+ Add equipment" (doc/gui/equipments.md, "Flow: Add an equipment"). */
function AddEquipmentModal({ form, groups, error, adding, onChange, onGroupCreated, onCancel, onSave }: AddEquipmentModalProps) {
  const set = (fields: Partial<NewEquipmentValues>) => onChange({ ...form, ...fields })

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal">
        <h2 className="modal__title">Add equipment</h2>
        {error && <div className="flash flash--error">{error}</div>}
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
          <GroupPicker groups={groups} current={form.groupId} onSelect={groupId => set({ groupId })} onCreated={onGroupCreated} />
        </div>
        <div className="form-field">
          <label className="form-field__label">Date of commissioning</label>
          <input type="date" aria-label="Date of commissioning" value={form.commissionedAt} onChange={e => set({ commissionedAt: e.target.value })} />
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
        {form.tracksHours && (
          <div className="form-field">
            <label className="form-field__label">Initial hours</label>
            <input type="number" min="0" aria-label="Initial hours" value={String(form.hours)} onChange={e => set({ hours: hoursFromInput(e.target.value) })} />
          </div>
        )}
        <div className="modal__actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn--accent" onClick={onSave} disabled={adding || !canAddEquipment(form)}>
            {adding ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface RenameGroupModalProps {
  name: string
  error: string | null
  saving: boolean
  onChange: (name: string) => void
  onCancel: () => void
  onSave: () => void
}

/** A group's Rename, from its menu. */
function RenameGroupModal({ name, error, saving, onChange, onCancel, onSave }: RenameGroupModalProps) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal">
        <h2 className="modal__title">Rename group</h2>
        {error && <div className="flash flash--error">{error}</div>}
        <div className="form-field">
          <label className="form-field__label">Name *</label>
          <input aria-label="Group name" value={name} onChange={e => onChange(e.target.value)} />
        </div>
        <div className="modal__actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn--accent" onClick={onSave} disabled={saving || !canRenameGroup(name)}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface DeleteGroupModalProps {
  /** The question, with the group's name and how many equipments it keeps (deleteGroupText). */
  text: string
  error: string | null
  deleting: boolean
  onCancel: () => void
  onDelete: () => void
}

/** A group's Delete, from its menu: its equipments are kept, with no group. */
function DeleteGroupModal({ text, error, deleting, onCancel, onDelete }: DeleteGroupModalProps) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal">
        <h2 className="modal__title">Delete group</h2>
        {error && <div className="flash flash--error">{error}</div>}
        <p className="confirm-text">{text}</p>
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
