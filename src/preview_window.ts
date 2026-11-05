interface WindowBounds { width: number, height: number }
interface WindowRect extends WindowBounds { left: number, top: number }

const margin = 8
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

export function constrainWindow (rect: WindowRect, bounds: WindowBounds): WindowRect {
  const width = clamp(rect.width, Math.min(360, Math.max(1, bounds.width - margin * 2)), Math.max(1, bounds.width - margin * 2))
  const height = clamp(rect.height, Math.min(240, Math.max(1, bounds.height - margin * 2)), Math.max(1, bounds.height - margin * 2))
  return { width, height, left: clamp(rect.left, margin, Math.max(margin, bounds.width - width - margin)), top: clamp(rect.top, margin, Math.max(margin, bounds.height - height - margin)) }
}

export function resizeWindow (rect: WindowRect, edge: string, dx: number, dy: number, bounds: WindowBounds): WindowRect {
  let { left, top } = rect
  let right = left + rect.width
  let bottom = top + rect.height
  const minWidth = Math.min(360, Math.max(1, bounds.width - margin * 2))
  const minHeight = Math.min(240, Math.max(1, bounds.height - margin * 2))
  if (edge.includes('w')) { left = clamp(left + dx, margin, right - minWidth) }
  if (edge.includes('e')) { right = clamp(right + dx, left + minWidth, bounds.width - margin) }
  if (edge.includes('n')) { top = clamp(top + dy, margin, bottom - minHeight) }
  if (edge.includes('s')) { bottom = clamp(bottom + dy, top + minHeight, bounds.height - margin) }
  return constrainWindow({ left, top, width: right - left, height: bottom - top }, bounds)
}

export function installPreviewWindow (dialog: HTMLDialogElement, header: HTMLElement, onLayout: () => void): { maximize: (enabled: boolean) => void, dispose: () => void } {
  const doc = dialog.ownerDocument
  const view = doc.defaultView
  const bounds = (): WindowBounds => ({ width: view?.innerWidth || doc.documentElement.clientWidth, height: view?.innerHeight || doc.documentElement.clientHeight })
  const current = (): WindowRect => {
    const rect = dialog.getBoundingClientRect()
    return constrainWindow({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }, bounds())
  }
  const apply = (rect: WindowRect): void => {
    Object.assign(dialog.style, { position: 'fixed', margin: '0', left: rect.left + 'px', top: rect.top + 'px', right: 'auto', bottom: 'auto', width: rect.width + 'px', height: rect.height + 'px' })
    onLayout()
  }
  let normal: WindowRect | null = null
  let gesture: { id: number, x: number, y: number, rect: WindowRect, edge: string, capture: Element } | null = null
  const finish = (): void => {
    if (!gesture) { return }
    const { id, capture } = gesture
    gesture = null
    delete dialog.dataset.previewAdjusting
    if (capture.hasPointerCapture?.(id)) { capture.releasePointerCapture(id) }
  }
  const start = (event: PointerEvent, edge: string): void => {
    if (event.button !== 0 || event.isPrimary === false || gesture || dialog.dataset.previewMaximized === 'true') { return }
    // Keep mouse focus and double-click behavior on the title bar intact.
    if (event.pointerType !== 'mouse') { event.preventDefault() }
    const capture = event.currentTarget instanceof Element ? event.currentTarget : dialog
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, rect: current(), edge, capture }
    dialog.dataset.previewAdjusting = edge || 'move'
    capture.setPointerCapture?.(event.pointerId)
  }
  const drag = (event: PointerEvent): void => {
    if (!(event.target instanceof Element) || event.target.closest('[data-preview-tools]')) { return }
    start(event, '')
  }
  const move = (event: PointerEvent): void => {
    if (!gesture || event.pointerId !== gesture.id) { return }
    const dx = event.clientX - gesture.x
    const dy = event.clientY - gesture.y
    normal = gesture.edge ? resizeWindow(gesture.rect, gesture.edge, dx, dy, bounds()) :
      constrainWindow({ ...gesture.rect, left: gesture.rect.left + dx, top: gesture.rect.top + dy }, bounds())
    apply(normal)
  }
  const end = (event: PointerEvent): void => { if (event.pointerId === gesture?.id) { finish() } }
  const keyboard = (event: KeyboardEvent): void => {
    if (event.target !== header || dialog.dataset.previewMaximized === 'true') { return }
    const steps: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }
    const step = steps[event.key]
    if (!step) { return }
    event.preventDefault()
    const rect = current()
    normal = event.shiftKey ? resizeWindow(rect, 'se', ...step, bounds()) :
      constrainWindow({ ...rect, left: rect.left + step[0], top: rect.top + step[1] }, bounds())
    apply(normal)
  }
  const layout = (): void => {
    if (dialog.dataset.previewMaximized === 'true') { apply({ left: 0, top: 0, ...bounds() }) } else if (normal) {
      normal = constrainWindow(normal, bounds())
      apply(normal)
    }
  }
  header.tabIndex = 0
  header.setAttribute('role', 'group')
  header.setAttribute('aria-label', '窗口标题栏：拖动或方向键移动，Shift 加方向键调整大小')
  header.title = '拖动移动窗口；方向键移动，Shift + 方向键调整大小'
  header.addEventListener('pointerdown', drag)
  header.addEventListener('keydown', keyboard)
  dialog.addEventListener('pointermove', move)
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) { dialog.addEventListener(name, end as EventListener) }
  const handles: HTMLElement[] = []
  for (const edge of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
    const handle = doc.createElement('span')
    handle.setAttribute('data-preview-resize', edge)
    handle.setAttribute('aria-hidden', 'true')
    handle.addEventListener('pointerdown', event => start(event, edge))
    dialog.append(handle)
    handles.push(handle)
  }
  view?.addEventListener('resize', layout)
  return {
    maximize (enabled) {
      finish()
      if (enabled) { normal = current() }
      dialog.dataset.previewMaximized = String(enabled)
      if (enabled) { apply({ left: 0, top: 0, ...bounds() }) } else if (normal) {
        normal = constrainWindow(normal, bounds())
        apply(normal)
      }
    },
    dispose () {
      finish()
      header.removeEventListener('pointerdown', drag)
      header.removeEventListener('keydown', keyboard)
      dialog.removeEventListener('pointermove', move)
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) { dialog.removeEventListener(name, end as EventListener) }
      view?.removeEventListener('resize', layout)
      handles.forEach(handle => handle.remove())
    }
  }
}
