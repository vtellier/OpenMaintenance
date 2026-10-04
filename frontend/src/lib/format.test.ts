import { describe, expect, it } from 'vitest'
import { formatFileSize, formatHours } from '@/lib/format'

describe('formatFileSize', () => {
  it('returns an empty string when the size is unknown', () => {
    expect(formatFileSize(undefined)).toBe('')
  })

  it('shows bytes below 1 KB', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(1023)).toBe('1023 B')
  })

  it('shows one decimal below 10 KB and whole kilobytes above', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(10 * 1024)).toBe('10 KB')
    expect(formatFileSize(500 * 1024)).toBe('500 KB')
  })

  it('shows one decimal below 10 MB and whole megabytes above', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatFileSize(5.5 * 1024 * 1024)).toBe('5.5 MB')
    expect(formatFileSize(25 * 1024 * 1024)).toBe('25 MB')
  })
})

describe('formatHours', () => {
  it('returns an empty string when the hours are unknown', () => {
    expect(formatHours(null)).toBe('')
    expect(formatHours(undefined)).toBe('')
  })

  it('rounds to whole hours', () => {
    expect(formatHours(0)).toBe('0 h')
    expect(formatHours(12.4)).toBe('12 h')
    expect(formatHours(12.5)).toBe('13 h')
  })

  it("groups thousands with the runtime locale's separator", () => {
    // The separator depends on the locale (1,235 / 1 235 / 1.235), so the
    // expectation is built with the same locale rather than hard-coded.
    expect(formatHours(1234.6)).toBe(`${new Intl.NumberFormat().format(1235)} h`)
  })
})
