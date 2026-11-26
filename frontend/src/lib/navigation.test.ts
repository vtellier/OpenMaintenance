import { describe, expect, it } from 'vitest'
import { isActiveSection } from '@/lib/navigation'

describe('isActiveSection', () => {
  it.each<[string, string, boolean]>([
    ['/', '/', true],
    ['/', '/equipments', false],
    ['/', '/no-such-page', false],
    ['/equipments', '/equipments', true],
    // An equipment page, its tabs and its forms highlight Equipments.
    ['/equipments', '/equipments/12', true],
    ['/equipments', '/equipments/12/history', true],
    ['/equipments', '/equipments/12/edit/hours/correct', true],
    ['/equipments', '/', false],
    ['/history', '/history', true],
    ['/history', '/equipments/12/history', false],
    ['/settings', '/settings', true],
    ['/settings', '/equipments', false],
    // Not Found highlights no section...
    ['/settings', '/no-such-page', false],
    // ...unless its path starts like one, as on pre-react.
    ['/settings', '/settingsx', true],
  ])('section %j on %j: %j', (sectionPath, currentPath, expected) => {
    expect(isActiveSection(sectionPath, currentPath)).toBe(expected)
  })
})
