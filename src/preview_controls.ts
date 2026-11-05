import { controlButtonStyle } from './control_styles.ts'
import { installPreviewWindow } from './preview_window.ts'

/** Move live nodes so table filters, checkboxes, and code settings are retained. */
function moveContent (parent: Element, content: Element, before: Node | null = null): void {
  if (typeof parent.moveBefore === 'function' && parent.isConnected && content.isConnected) {
    parent.moveBefore(content, before)
  } else {
    parent.insertBefore(content, before)
  }
}

const activeDocuments = new WeakSet<Document>()

interface PreviewHooks {
  container?: HTMLElement
  headerActions?: HTMLElement[]
  beforeClose?: () => Promise<boolean>
  onClose?: () => void
}

export function openPreview (opener: HTMLElement, hooks: PreviewHooks = {}): boolean {
  const wrapper = hooks.container || opener.closest<HTMLElement>('[data-preview-container]')
  const content = wrapper?.querySelector<HTMLElement>('[data-preview-content]')
  if (!wrapper || !content) { return false }
  const doc = opener.ownerDocument
  if (activeDocuments.has(doc)) { return false }
  const dialog = doc.createElement('dialog')
  if (typeof dialog.showModal !== 'function') { return false }
  dialog.setAttribute('data-preview-dialog', '')
  const title = wrapper.dataset.previewTitle || '内容预览'
  dialog.setAttribute('aria-label', title + ' · 放大预览')

  const header = doc.createElement('div')
  header.setAttribute('data-preview-header', '')
  const heading = doc.createElement('strong')
  heading.textContent = title
  const tools = doc.createElement('div')
  tools.setAttribute('data-preview-tools', '')
  if (hooks.headerActions) { tools.append(...hooks.headerActions) }
  function button (label: string, name: string, action: () => void): HTMLButtonElement {
    const result = doc.createElement('button')
    result.type = 'button'
    result.textContent = label
    result.setAttribute('aria-label', name)
    result.style.cssText = controlButtonStyle
    result.addEventListener('click', action)
    tools.append(result)
    return result
  }
  const viewport = doc.createElement('div')
  viewport.setAttribute('data-preview-viewport', '')
  const stage = doc.createElement('div')
  stage.setAttribute('data-preview-stage', '')
  viewport.append(stage)
  const fitWidth = (): void => {
    const style = doc.defaultView?.getComputedStyle(viewport)
    const padding = parseFloat(style?.paddingLeft || '0') + parseFloat(style?.paddingRight || '0')
    stage.style.width = Math.max(1, viewport.clientWidth - padding) + 'px'
    const verticalPadding = parseFloat(style?.paddingTop || '0') + parseFloat(style?.paddingBottom || '0')
    const modelToolbar = content.querySelector('[data-neural-model], [data-document-toolbar]') ? 140 : 0
    dialog.style.setProperty('--preview-media-height', Math.max(120, viewport.clientHeight - verticalPadding - modelToolbar) + 'px')
  }
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fitWidth)
  const windowControls = installPreviewWindow(dialog, header, fitWidth)
  let scale = 100
  const updateScale = (value: number): void => {
    scale = Math.max(50, Math.min(300, value))
    stage.style.zoom = String(scale / 100)
    reset.textContent = scale + '%'
    smaller.disabled = scale === 50
    larger.disabled = scale === 300
  }
  const smaller = button('−', '缩小内容', () => updateScale(scale - 25))
  const reset = button('100%', '恢复原始比例', () => updateScale(100))
  const larger = button('+', '放大内容', () => updateScale(scale + 25))
  const maximize = button('铺满窗口', '切换铺满窗口', () => {
    const enabled = dialog.dataset.previewMaximized !== 'true'
    windowControls.maximize(enabled)
    maximize.setAttribute('aria-pressed', String(enabled))
    maximize.textContent = enabled ? '还原窗口' : '铺满窗口'
    fitWidth()
  })
  maximize.setAttribute('aria-pressed', 'false')
  header.addEventListener('dblclick', event => {
    if (event.target instanceof Element && !event.target.closest('[data-preview-tools]')) { maximize.click() }
  })
  let pendingClose = false
  const requestClose = (): void => {
    if (!hooks.beforeClose) { dialog.close(); return }
    if (pendingClose) { return }
    pendingClose = true
    void hooks.beforeClose().then(confirmed => {
      if (confirmed && !cleaned) { dialog.close() }
    }).catch(() => {}).finally(() => { pendingClose = false })
  }
  const close = button('关闭 ×', '关闭预览', requestClose)
  header.append(heading, tools)
  dialog.append(header, viewport)

  const marker = doc.createComment('markdown-it preview position')
  const overflow = doc.documentElement.style.getPropertyValue('overflow')
  const priority = doc.documentElement.style.getPropertyPriority('overflow')
  let cleaned = false
  const cleanup = (): void => {
    if (cleaned) { return }
    cleaned = true
    windowControls.dispose()
    resize?.disconnect()
    doc.defaultView?.removeEventListener('resize', fitWidth)
    if (marker.parentElement) {
      moveContent(marker.parentElement, content, marker)
    }
    marker.remove()
    dialog.remove()
    activeDocuments.delete(doc)
    if (overflow) { doc.documentElement.style.setProperty('overflow', overflow, priority) } else { doc.documentElement.style.removeProperty('overflow') }
    opener.setAttribute('aria-expanded', 'false')
    if (opener.isConnected) { opener.focus({ preventScroll: true }) }
    hooks.onClose?.()
  }
  dialog.addEventListener('close', cleanup)
  dialog.addEventListener('cancel', event => {
    event.preventDefault()
    requestClose()
  })
  let startedOnBackdrop = false
  const isBackdrop = (event: MouseEvent): boolean => {
    const rect = dialog.getBoundingClientRect()
    return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
  }
  dialog.addEventListener('pointerdown', event => { startedOnBackdrop = isBackdrop(event) })
  dialog.addEventListener('click', event => {
    if (startedOnBackdrop && isBackdrop(event)) { requestClose() }
    startedOnBackdrop = false
  })

  doc.body.append(dialog)
  try {
    dialog.showModal()
    content.before(marker)
    moveContent(stage, content)
    fitWidth()
    if (resize) { resize.observe(viewport) } else { doc.defaultView?.addEventListener('resize', fitWidth) }
    activeDocuments.add(doc)
    doc.documentElement.style.setProperty('overflow', 'hidden', 'important')
    opener.setAttribute('aria-expanded', 'true')
    close.focus()
    return true
  } catch {
    cleanup()
    return false
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) { return }
    const opener = event.target.closest<HTMLElement>('[data-preview-open]')
    if (!opener) { return }
    event.preventDefault()
    openPreview(opener)
  })
}

export {}
