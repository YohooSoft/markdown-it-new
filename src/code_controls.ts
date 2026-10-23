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

function applyCodeTheme (block: HTMLElement, theme: string, background: string): void {
  const pre = block.querySelector<HTMLElement>('[data-code-pre]')
  const numbers = block.querySelectorAll<HTMLElement>('[data-code-line-number]')
  if (!pre) { return }

  const themes: Record<string, { color: string, number: string }> = {
    github: { color: '#24292f', number: '#6e7781' },
    'github-dark': { color: '#c9d1d9', number: '#8b949e' },
    monokai: { color: '#f8f8f2', number: '#75715e' },
    dracula: { color: '#f8f8f2', number: '#6272a4' },
    'solarized-light': { color: '#657b83', number: '#93a1a1' }
  }
  const selected = themes[theme] ?? themes.github
  pre.style.background = background === 'dark' ? '#0f172a' : '#ffffff'
  pre.style.color = selected.color
  numbers.forEach(number => {
    number.style.color = selected.number
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
  const background = block.querySelector<HTMLSelectElement>('[data-code-background]')
  const wrap = block.querySelector<HTMLInputElement>('[data-code-wrap]')
  const numbers = block.querySelector<HTMLInputElement>('[data-code-line-numbers]')
  if (style) { style.value = 'github' }
  if (background) { background.value = 'light' }
  if (wrap) { wrap.checked = false }
  if (numbers) { numbers.checked = false }
  applyCodeTheme(block, 'github', 'light')
  applyCodeWrap(block, false)
  applyCodeLineNumbers(block, false)
}

function ensureCodeCursorStyle (doc: Document): void {
  if (doc.head.querySelector('[data-code-cursor-style]')) { return }
  const style = doc.createElement('style')
  style.dataset.codeCursorStyle = ''
  style.textContent = '@keyframes markdown-it-code-cursor-blink{0%,45%{opacity:1}46%,100%{opacity:0}}'
  doc.head.append(style)
}

async function streamCode (block: HTMLElement, button: HTMLElement): Promise<void> {
  if (block.dataset.codeStreamPlayed === 'true' || block.dataset.codeStreaming === 'true') { return }
  const code = block.querySelector<HTMLElement>('[data-code-code]')
  if (!code) { return }

  const lines = Array.from(code.querySelectorAll<HTMLElement>('[data-code-line-content]'))
  const original = code.innerHTML
  const cursor = code.ownerDocument.createElement('span')
  cursor.setAttribute('aria-hidden', 'true')
  cursor.style.cssText = 'display:inline-block;width:.58em;height:1.05em;margin-left:2px;vertical-align:-.15em;background:currentColor;opacity:.8;animation:markdown-it-code-cursor-blink 1s steps(1,end) infinite;'
  ensureCodeCursorStyle(code.ownerDocument)
  block.dataset.codeStreaming = 'true'
  button.setAttribute('disabled', '')
  button.textContent = '播放中…'

  try {
    for (const line of lines) {
      const content = line.textContent ?? ''
      line.textContent = ''
      for (let i = 0; i < content.length; i++) {
        line.textContent = content.slice(0, i + 1)
        line.append(cursor)
        await new Promise<void>(resolve => setTimeout(resolve, 14))
      }
      if (content.length === 0) { line.append(cursor) }
      await new Promise<void>(resolve => setTimeout(resolve, 45))
      cursor.remove()
    }
    cursor.remove()
    code.innerHTML = original
    block.dataset.codeStreamPlayed = 'true'
    button.textContent = '已播放'
  } finally {
    cursor.remove()
    delete block.dataset.codeStreaming
    button.removeAttribute('disabled')
  }
}

function handleCodeControlEvent (event: Event): void {
  const eventTarget = event.target
  if (!(eventTarget instanceof Element)) { return }
  const target = eventTarget.closest<HTMLElement>('[data-code-mode-toggle], [data-code-mode], [data-code-copy], [data-code-settings], [data-code-style], [data-code-background], [data-code-wrap], [data-code-line-numbers], [data-code-stream]')
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
  } else if (target.matches('[data-code-stream]')) {
    void streamCode(block, target)
  } else if (target.matches('[data-code-style], [data-code-background]')) {
    const style = block.querySelector<HTMLSelectElement>('[data-code-style]')?.value ?? 'github'
    const background = block.querySelector<HTMLSelectElement>('[data-code-background]')?.value ?? 'light'
    applyCodeTheme(block, style, background)
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
