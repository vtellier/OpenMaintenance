import { describe, expect, it } from 'vitest'
import { CARD_TASK_NAME_MAX, cardStatusLine, cropText, lastInterventionText, tasksByEquipment } from '@/lib/equipmentCard'

// What an equipment's card says (doc/gui/equipments.md, "Card content").

describe('cropText', () => {
  it('keeps a text of up to 30 characters whole', () => {
    expect(CARD_TASK_NAME_MAX).toBe(30)
    const thirty = 'a'.repeat(30)
    expect(cropText(thirty)).toBe(thirty)
    expect(cropText('Oil change')).toBe('Oil change')
    expect(cropText('')).toBe('')
  })

  it('cuts a longer text at 30 characters and adds an ellipsis', () => {
    expect(cropText('a'.repeat(31))).toBe('a'.repeat(30) + '…')
    expect(cropText('Replace the raw water pump impeller and gasket')).toBe('Replace the raw water pump imp…')
  })

  it('counts an emoji as one character and never splits it', () => {
    const name = '🔧'.repeat(31)
    expect(cropText(name)).toBe('🔧'.repeat(30) + '…')
    expect(cropText('🔧'.repeat(30))).toBe('🔧'.repeat(30))
  })

  it('takes another limit', () => {
    expect(cropText('Oil change', 3)).toBe('Oil…')
  })
})

describe('tasksByEquipment', () => {
  it('files each task under its equipment, in the order given', () => {
    expect(tasksByEquipment([
      { id: 1, equipmentId: 2 },
      { id: 2, equipmentId: 1 },
      { id: 3, equipmentId: 2 },
    ])).toEqual({ 1: [{ id: 2, equipmentId: 1 }], 2: [{ id: 1, equipmentId: 2 }, { id: 3, equipmentId: 2 }] })
  })

  it('files a task with no equipment under 0, and has no entry for an equipment with no task', () => {
    const orphan: { id: number, equipmentId?: number } = { id: 1 }
    expect(tasksByEquipment([orphan])).toEqual({ 0: [{ id: 1 }] })
    expect(tasksByEquipment([])).toEqual({})
  })
})

describe('lastInterventionText', () => {
  const tasks = [{ id: 10, name: 'Oil change' }]

  it("names the latest intervention's task and date", () => {
    expect(lastInterventionText({ taskId: 10, date: '2026-04-12' }, tasks)).toBe('Last: Oil change, 2026-04-12')
  })

  it('says so when there is none', () => {
    expect(lastInterventionText(null, tasks)).toBe('No intervention yet')
  })

  it('leaves the name empty for an unknown task, and the date for a missing one', () => {
    expect(lastInterventionText({ taskId: 999, date: '2026-04-12' }, tasks)).toBe('Last: , 2026-04-12')
    expect(lastInterventionText({ taskId: 10 }, tasks)).toBe('Last: Oil change, ')
  })
})

describe('cardStatusLine', () => {
  const overdue = (id: number, name: string, urgency: number, dueInHours: number) =>
    ({ id, name, dueStatus: 'overdue' as const, urgency, dueTrigger: 'hours' as const, dueInHours })
  const dueSoon = (id: number, name: string, urgency: number, dueInDays: number) =>
    ({ id, name, dueStatus: 'due_soon' as const, urgency, dueTrigger: 'months' as const, dueInDays })
  const ok = (id: number, name: string) => ({ id, name, dueStatus: 'ok' as const, urgency: 0.2, dueTrigger: 'months' as const, dueInDays: 120 })

  it('names the one overdue task and its timing text', () => {
    expect(cardStatusLine([overdue(1, 'Oil change', 1.2, -120), ok(2, 'Impeller')]))
      .toEqual({ status: 'overdue', text: 'Oil change — 120 h ago' })
  })

  it('crops the name of the one task to 30 characters', () => {
    expect(cardStatusLine([dueSoon(1, 'Replace the raw water pump impeller and gasket', 0.9, 12)]))
      .toEqual({ status: 'due_soon', text: 'Replace the raw water pump imp… — in 12d' })
  })

  it("counts the tasks with the worst status and gives the most urgent one's timing text", () => {
    expect(cardStatusLine([
      overdue(1, 'Oil change', 1.1, -20),
      dueSoon(2, 'Belt', 0.95, 3),
      overdue(3, 'Impeller', 1.8, -150),
      overdue(4, 'Anodes', 1.3, -40),
    ])).toEqual({ status: 'overdue', text: '3 tasks — most urgent 150 h ago' })
  })

  it('counts only the due soon tasks when none is overdue', () => {
    expect(cardStatusLine([dueSoon(1, 'Belt', 0.9, 10), dueSoon(2, 'Filter', 0.97, 2), ok(3, 'Impeller')]))
      .toEqual({ status: 'due_soon', text: '2 tasks — most urgent in 2d' })
  })

  it('picks the most urgent one by name, then id, on a tie in urgency', () => {
    expect(cardStatusLine([
      { id: 2, name: 'Oil change', dueStatus: 'overdue', urgency: 1.5, dueTrigger: 'months', dueInDays: -3 },
      { id: 1, name: 'Belt', dueStatus: 'overdue', urgency: 1.5, dueTrigger: 'months', dueInDays: -9 },
    ])).toEqual({ status: 'overdue', text: '2 tasks — most urgent 9d ago' })
  })

  it('leaves the timing text out when it is empty', () => {
    expect(cardStatusLine([{ id: 1, name: 'Oil change', dueStatus: 'overdue', urgency: 1 }]))
      .toEqual({ status: 'overdue', text: 'Oil change' })
    expect(cardStatusLine([
      { id: 1, name: 'Oil change', dueStatus: 'overdue', urgency: 1 },
      { id: 2, name: 'Belt', dueStatus: 'overdue', urgency: 2 },
    ])).toEqual({ status: 'overdue', text: '2 tasks' })
  })

  it('reads All clear! when every task is OK', () => {
    expect(cardStatusLine([ok(1, 'Oil change'), ok(2, 'Impeller')])).toEqual({ status: 'ok', text: 'All clear!' })
  })

  it('has no line for an equipment with no task, or a decommissioned one', () => {
    expect(cardStatusLine([])).toBeNull()
    // A decommissioned equipment's tasks have no due status.
    expect(cardStatusLine([{ id: 1, name: 'Oil change' }])).toBeNull()
  })
})
