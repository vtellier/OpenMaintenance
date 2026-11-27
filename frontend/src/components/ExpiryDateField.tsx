import type { CalendarDate } from '@/lib/calendar-date'

export interface ExpiryDateFieldProps {
  /** The expiry date entered; '' when none is. */
  value: CalendarDate | ''
  onChange: (expiryDate: CalendarDate | '') => void
}

/**
 * The required Expiry date field of an intervention on an expiry task, in the
 * intervention form. The form shows it only for an expiry task (isExpiryTask
 * in lib/interventionForm.ts).
 */
export function ExpiryDateField({ value, onChange }: ExpiryDateFieldProps) {
  return (
    <div className="form-field">
      <label className="form-field__label">Expiry date *</label>
      <input type="date" aria-label="Expiry date" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}
