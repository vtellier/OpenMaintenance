import { html } from '@arrow-js/core'

// expiryDateField renders the required Expiry date field of an intervention
// on an expiry task, in the intervention form. It reads and writes
// `form.expiryDate` (a reactive form state); the caller shows it only for an
// expiry task.
export function expiryDateField(form: { expiryDate: string }) {
  function onExpiryDateChange(e: Event) {
    form.expiryDate = (e.target as HTMLInputElement).value
  }

  return html`
    <div class="form-field">
      <label class="form-field__label">Expiry date *</label>
      <input type="date" aria-label="Expiry date" .value="${() => form.expiryDate}" @input="${onExpiryDateChange}" />
    </div>
  `
}
