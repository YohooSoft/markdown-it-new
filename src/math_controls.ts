/** Serialize selected DOM without copying MathJax's visual/assistive duplicates. */
export function mathSelectionText (fragment: Node): { text: string, formulas: number } {
  let text = ''
  let formulas = 0
  let pendingBreak = false
  const append = (value: string): void => {
    if (!value) { return }
    if (pendingBreak && text && !text.endsWith('\n') && !value.startsWith('\n')) { text += '\n' }
    pendingBreak = false; text += value
  }
  const visit = (node: Node): void => {
    if (node.nodeType === 3) { append(node.nodeValue || ''); return }
    if (node.nodeType !== 1 && node.nodeType !== 11) { return }
    const element = node.nodeType === 1 ? node as Element : null
    if (element) {
      if (['data-preview-toolbar', 'data-preview-header', 'data-preview-tools'].some(attr => element.hasAttribute(attr))) { return }
      const syntax = element.hasAttribute('data-math-container') && element.getAttribute('data-math-source')
      if (syntax) {
        const block = element.hasAttribute('data-math-display')
        if (block) { pendingBreak = true }
        append(syntax); formulas++
        if (block) { pendingBreak = true }
        return
      }
      const name = element.tagName.toLowerCase()
      if (name === 'br') { append('\n'); return }
      if (['script', 'style'].includes(name)) { return }
      const block = ['p', 'div', 'section', 'article', 'blockquote', 'li', 'ul', 'ol', 'pre', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(name)
      if (block) { pendingBreak = true }
      for (const child of Array.from(node.childNodes)) { visit(child) }
      if (block) { pendingBreak = true }
      if (['td', 'th'].includes(name) && element.nextElementSibling) { append('\t') }
      return
    }
    for (const child of Array.from(node.childNodes)) { visit(child) }
  }
  visit(fragment)
  return { text, formulas }
}

function enclosingFormula (node: Node): Element | null {
  const element = node.nodeType === 1 ? node as Element : node.parentElement
  const formula = element?.closest('[data-math-container]')
  return formula?.hasAttribute('data-math-source') ? formula : null
}

/** Native copy events cover Ctrl/Cmd+C and the browser's context-menu Copy. */
export function copyMathSelection (event: ClipboardEvent, doc: Document): void {
  const active = doc.activeElement as HTMLElement | null
  if (active && (['input', 'textarea'].includes(active.tagName.toLowerCase()) || active.isContentEditable)) { return }
  const selection = doc.getSelection()
  if (!event.clipboardData || !selection || selection.isCollapsed || selection.rangeCount !== 1) { return }
  const range = selection.getRangeAt(0).cloneRange()
  // Partial visual selections copy the whole formula. Mapping glyphs back to
  // a TeX subexpression would require a separate semantic selection engine.
  const first = enclosingFormula(range.startContainer)
  const last = enclosingFormula(range.endContainer)
  if (!first && !last) {
    const root = range.commonAncestorContainer
    const element = root?.nodeType === 1 ? root as Element : root?.parentElement
    if (element && !Array.from(element.querySelectorAll('[data-math-container]')).some(formula => range.intersectsNode(formula))) { return }
  }
  if (first) { range.setStartBefore(first) }
  if (last) { range.setEndAfter(last) }
  const result = mathSelectionText(range.cloneContents())
  if (!result.formulas) { return }
  event.clipboardData.setData('text/plain', result.text)
  event.preventDefault()
}

if (typeof document !== 'undefined') {
  document.addEventListener('copy', event => { copyMathSelection(event, document) })
}
