import { html, reactive } from '@arrow-js/core'
import 'emoji-picker-element'
// Bundle the emoji data locally so the picker works fully offline (this app is
// self-hosted and may run with no internet, e.g. on a boat). `?url` makes Vite
// emit the JSON as a same-origin asset instead of relying on the default CDN.
import emojiDataUrl from 'emoji-picker-element-data/en/emojibase/data.json?url'

export const DEFAULT_ICON = '🔧'

// iconPicker renders a button showing the current icon; clicking it opens a
// full searchable emoji picker (the `emoji-picker-element` web component) in a
// popover. There is no text field — selecting an emoji sets the value and
// closes the popover. `current()` reads the value, `onSelect(value)` stores it.
export function iconPicker(current: () => string, onSelect: (value: string) => void) {
  const ui = reactive({ open: false })

  function toggle() {
    ui.open = !ui.open
  }

  function close() {
    ui.open = false
  }

  function onEmojiClick(e: Event) {
    const unicode = (e as CustomEvent).detail?.unicode
    if (unicode) onSelect(unicode)
    ui.open = false
  }

  function onReset() {
    onSelect(DEFAULT_ICON)
    ui.open = false
  }

  return html`
    <div class="icon-picker">
      <button type="button" class="icon-picker__button" @click="${toggle}">
        <span class="icon-picker__current">${() => current() || DEFAULT_ICON}</span>
        <span class="icon-picker__label">Choose icon</span>
        <span class="icon-picker__caret">▾</span>
      </button>
      ${() => ui.open ? html`
        <div class="icon-picker__backdrop" @click="${close}"></div>
        <div class="icon-picker__popover">
          <emoji-picker data-source="${emojiDataUrl}" @emoji-click="${onEmojiClick}"></emoji-picker>
          <button type="button" class="btn btn--small icon-picker__reset" @click="${onReset}">Reset to ${DEFAULT_ICON}</button>
        </div>
      ` : null}
    </div>`
}
