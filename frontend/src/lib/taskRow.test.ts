import { describe, expect, it } from 'vitest'
import { dueIndicator, lastDoneText, triggerText } from '@/lib/taskRow'

// A task row on an equipment's Tasks tab (doc/gui/tasks.md, "Content").

describe('triggerText', () => {
  it('reads both intervals with one "Every"', () => {
    expect(triggerText({ kind: 'interval', hoursInterval: 100, monthsInterval: 6 })).toBe('Every 100h or 6mo')
  })

  it('reads an hours interval alone', () => {
    expect(triggerText({ kind: 'interval', hoursInterval: 250 })).toBe('Every 250h')
  })

  it('reads a months interval alone with no "Every", as pre-react did', () => {
    expect(triggerText({ kind: 'interval', monthsInterval: 24 })).toBe('24mo')
  })

  it('reads a task of no known kind as an interval task', () => {
    expect(triggerText({ hoursInterval: 50, monthsInterval: 12 })).toBe('Every 50h or 12mo')
  })

  it('reads an expiry task as "On expiry date", whatever intervals it holds', () => {
    expect(triggerText({ kind: 'expiry', monthsInterval: 6 })).toBe('On expiry date')
  })

  it('is empty for an interval task with no interval', () => {
    expect(triggerText({ kind: 'interval', hoursInterval: 0 })).toBe('')
  })
})

describe('dueIndicator', () => {
  it('an overdue task is red, with its timing text', () => {
    expect(dueIndicator({ dueStatus: 'overdue', dueTrigger: 'hours', dueInHours: -32 }))
      .toEqual({ className: 'due-indicator due-indicator--overdue', text: 'Overdue — 32 h ago' })
  })

  it('a task due soon is amber, with its timing text', () => {
    expect(dueIndicator({ dueStatus: 'due_soon', dueTrigger: 'expiry', dueInDays: 12 }))
      .toEqual({ className: 'due-indicator due-indicator--due-soon', text: 'Due soon — Expires in 12 days' })
  })

  it('an OK task reads "OK" alone', () => {
    expect(dueIndicator({ dueStatus: 'ok', dueTrigger: 'months', dueInDays: 90 }))
      .toEqual({ className: 'due-indicator due-indicator--ok', text: 'OK' })
  })

  it('shows none for a task with no due status (a decommissioned equipment)', () => {
    expect(dueIndicator({})).toBeNull()
    expect(dueIndicator({ dueStatus: undefined, dueTrigger: 'months', dueInDays: -3 })).toBeNull()
  })
})

describe('lastDoneText', () => {
  it('reads the date and the reading of the last intervention', () => {
    expect(lastDoneText({ date: '2026-03-27', hoursAt: 380 })).toBe('2026-03-27 • 380 h')
  })

  it('reads the date alone when the intervention has no reading', () => {
    expect(lastDoneText({ date: '2026-03-27' })).toBe('2026-03-27')
    expect(lastDoneText({ date: '2026-03-27', hoursAt: null })).toBe('2026-03-27')
  })

  it('keeps a reading of 0', () => {
    expect(lastDoneText({ date: '2026-03-27', hoursAt: 0 })).toBe('2026-03-27 • 0 h')
  })

  it('reads "never" when the task was never done', () => {
    expect(lastDoneText(null)).toBe('never')
  })
})
