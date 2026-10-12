const installedDocuments = new WeakSet<Document>()

function codeBlockForTarget (target: Element): HTMLElement | null {
  return target.closest<HTMLElement>('[data-code-block]')
}

function codeText (block: HTMLElement): string {
  return Array.from(block.querySelectorAll<HTMLElement>('[data-code-line-content]'))
    .map(line => line.textContent ?? '')
    .join('\n')
}

function closeCodeMenus (block: HTMLElement, except?: HTMLElement): void {
  block.querySelectorAll<HTMLElement>('[data-code-mode-menu], [data-code-settings-menu]').forEach(menu => {
    if (menu !== except) { menu.hidden = true }
  })
}

function applyCodeTheme (block: HTMLElement, theme: string): void {
  const pre = block.querySelector<HTMLElement>('[data-code-pre]')
  const numbers = block.querySelectorAll<HTMLElement>('[data-code-line-number]')
  if (!pre) { return }

  const dark = theme === 'dark'
  pre.style.background = dark ? '#0f172a' : '#fff'
  pre.style.color = dark ? '#e2e8f0' : '#1f2937'
  numbers.forEach(number => {
    number.style.color = dark ? '#64748b' : '#94a3b8'
  })
}

function applyCodeWrap (block: HTMLElement, enabled: boolean): void {
  const code = block.querySelector<HTMLElement>('[data-code-code]')
  if (!code) { return }
  code.style.whiteSpace = enabled ? 'pre-wrap' : 'pre'
  code.style.overflowWrap = enabled ? 'anywhere' : 'normal'
}

function applyCodeLineNumbers (block: HTMLElement, enabled: boolean): void {
  block.querySelectorAll<HTMLElement>('[data-code-line-number]').forEach(number => {
    number.hidden = !enabled
  })
}

function resetCodeSettings (block: HTMLElement): void {
  const style = block.querySelector<HTMLSelectElement>('[data-code-style]')
  const wrap = block.querySelector<HTMLInputElement>('[data-code-wrap]')
  const numbers = block.querySelector<HTMLInputElement>('[data-code-line-numbers]')
  if (style) { style.value = 'light' }
  if (wrap) { wrap.checked = false }
  if (numbers) { numbers.checked = false }
  applyCodeTheme(block, 'light')
  applyCodeWrap(block, false)
  applyCodeLineNumbers(block, false)
}

function handleCodeControlEvent (event: Event): void {
  const eventTarget = event.target
  if (!(eventTarget instanceof Element)) { return }
  const target = eventTarget.closest<HTMLElement>('[data-code-mode-toggle], [data-code-mode], [data-code-copy], [data-code-settings], [data-code-style], [data-code-wrap], [data-code-line-numbers]')
  if (!target) { return }

  const block = codeBlockForTarget(target)
  if (!block) { return }

  if (target.matches('[data-code-mode-toggle]')) {
    const menu = block.querySelector<HTMLElement>('[data-code-mode-menu]')
    if (menu) {
      const opening = menu.hidden
      closeCodeMenus(block, opening ? menu : undefined)
      menu.hidden = !opening
    }
  } else if (target.matches('[data-code-settings]')) {
    const menu = block.querySelector<HTMLElement>('[data-code-settings-menu]')
    if (menu) {
      const opening = menu.hidden
      closeCodeMenus(block, opening ? menu : undefined)
      menu.hidden = !opening
      target.setAttribute('aria-expanded', String(opening))
    }
  } else if (target.matches('[data-code-mode]')) {
    const mode = target.dataset.codeMode ?? 'embed'
    const toggle = block.querySelector<HTMLElement>('[data-code-mode-toggle]')
    if (toggle) { toggle.firstChild!.textContent = mode === 'raw' ? 'Raw ' : 'Embed ' }
    block.querySelectorAll<HTMLElement>('[data-code-mode]').forEach(option => {
      const selected = option.dataset.codeMode === mode
      option.setAttribute('aria-selected', String(selected))
      option.style.background = selected ? '#f8fafc' : 'transparent'
    })
    const menu = block.querySelector<HTMLElement>('[data-code-mode-menu]')
    if (menu) { menu.hidden = true }
  } else if (target.matches('[data-code-copy]')) {
    const copy = async (): Promise<void> => {
      await navigator.clipboard?.writeText(codeText(block))
      target.setAttribute('title', '已复制')
      setTimeout(() => target.setAttribute('title', '复制代码'), 1200)
    }
    void copy()
  } else if (target.matches('[data-code-style]')) {
    applyCodeTheme(block, (target as HTMLSelectElement).value)
  } else if (target.matches('[data-code-wrap]')) {
    applyCodeWrap(block, (target as HTMLInputElement).checked)
  } else if (target.matches('[data-code-line-numbers]')) {
    applyCodeLineNumbers(block, (target as HTMLInputElement).checked)
  }
}

function installCodeControls (doc: Document): void {
  if (installedDocuments.has(doc)) { return }
  doc.addEventListener('click', handleCodeControlEvent)
  doc.addEventListener('change', handleCodeControlEvent)
  installedDocuments.add(doc)
}

if (typeof document !== 'undefined') {
  installCodeControls(document)
}

export {}
