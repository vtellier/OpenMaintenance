import { html, reactive } from '@arrow-js/core'
import 'emoji-picker-element'
// Bundle the emoji data locally so the picker works fully offline (this app is
// self-hosted and may run with no internet, e.g. on a boat). `?url` makes Vite
// emit the JSON as a same-origin asset instead of relying on the default CDN.
import emojiDataUrl from 'emoji-picker-element-data/en/emojibase/data.json?url'
import { DEFAULT_ICON } from '@/lib/equipmentForm'

export interface IconPickerOptions {
  // 'button' (default): a labelled "Choose icon ▾" button, for forms.
  // 'avatar': the icon shown as a clickable avatar (used in the detail header).
  // 'menuitem': a plain "Change icon" item, for a menu (a group's section header).
  variant?: 'button' | 'avatar' | 'menuitem'
  // The icon Reset restores and the trigger shows when there is none.
  // Defaults to the equipment default, DEFAULT_ICON (🔧).
  defaultIcon?: string
}

// iconPicker renders a trigger showing the current icon; clicking it opens a
// full searchable emoji picker (the `emoji-picker-element` web component) in a
// popover. There is no text field — selecting an emoji sets the value and
// closes the popover. `current()` reads the value, `onSelect(value)` stores it.
export function iconPicker(current: () => string, onSelect: (value: string) => void, opts: IconPickerOptions = {}) {
  const ui = reactive({ open: false })
  const defaultIcon = opts.defaultIcon ?? DEFAULT_ICON

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
    onSelect(defaultIcon)
    ui.open = false
  }

  const trigger = opts.variant === 'menuitem'
    ? html`<button type="button" class="menu__item" @click="${toggle}">Change icon</button>`
    : opts.variant === 'avatar'
    ? html`<button type="button" class="equipment-avatar equipment-avatar--lg icon-picker__avatar" title="Change icon" @click="${toggle}">
        <span class="equipment-avatar__emoji">${() => current() || defaultIcon}</span>
      </button>`
    : html`<button type="button" class="icon-picker__button" @click="${toggle}">
        <span class="icon-picker__current">${() => current() || defaultIcon}</span>
        <span class="icon-picker__label">Choose icon</span>
        <span class="icon-picker__caret">▾</span>
      </button>`

  return html`
    <div class="icon-picker">
      ${trigger}
      ${() => ui.open ? html`
        <div class="icon-picker__backdrop" @click="${close}"></div>
        <div class="icon-picker__popover">
          <emoji-picker data-source="${emojiDataUrl}" @emoji-click="${onEmojiClick}"></emoji-picker>
          <button type="button" class="btn btn--small icon-picker__reset" @click="${onReset}">Reset to ${defaultIcon}</button>
        </div>
      ` : null}
    </div>`
}
