import { describe, expect, it } from 'vitest'
import { dueTimingText } from '@/lib/dueTiming'

describe('dueTimingText', () => {
  it('renders the days of a months-driven task', () => {
    expect(dueTimingText({ dueTrigger: 'months', dueInDays: -3 })).toBe('3d ago')
    expect(dueTimingText({ dueTrigger: 'months', dueInDays: 0 })).toBe('today')
    expect(dueTimingText({ dueTrigger: 'months', dueInDays: 12 })).toBe('in 12d')
  })

  it('renders the hours of an hours-driven task', () => {
    expect(dueTimingText({ dueTrigger: 'hours', dueInHours: -120 })).toBe('120 h ago')
    expect(dueTimingText({ dueTrigger: 'hours', dueInHours: 0.2 })).toBe('now')
    expect(dueTimingText({ dueTrigger: 'hours', dueInHours: 8 })).toBe('in 8 h')
  })

  it('shows the driving amount even when the other rule has one too', () => {
    expect(dueTimingText({ dueTrigger: 'hours', dueInHours: -500, dueInDays: 730 })).toBe('500 h ago')
  })

  it('says "never done" for a months-driven task with no amount', () => {
    expect(dueTimingText({ dueTrigger: 'months', dueInDays: undefined })).toBe('never done')
    expect(dueTimingText({ dueTrigger: 'months', dueInDays: null as unknown as undefined })).toBe('never done')
  })

  it('is empty when no rule applies or the hours amount is unknown', () => {
    expect(dueTimingText({})).toBe('')
    expect(dueTimingText({ dueTrigger: 'hours' })).toBe('')
  })
})
