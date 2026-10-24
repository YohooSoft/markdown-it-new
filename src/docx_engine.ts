import { DocxDocument } from './docx_document.ts'
import type { DocxStyle } from './docx_document.ts'
import type { WordEngine, WordEngineFactory } from './word_editor.ts'

const commands = new Set(['undo', 'redo', 'bold', 'italic', 'underline', 'font', 'size', 'color', 'left', 'center', 'right', 'justify', 'heading', 'spacing', 'pageBreak', 'portrait', 'landscape', 'margins'])

/** Stage-one pagination keeps a paragraph or table together; oversized blocks grow. */
export function docxPageGroups (blocks: Array<{ height: number, breakBefore: boolean }>, height: number): number[][] {
  const pages: number[][] = [[]]
  let used = 0
  blocks.forEach((block, index) => {
    if (pages[pages.length - 1].length && (block.breakBefore || used + block.height > height)) { pages.push([]); used = 0 }
    pages[pages.length - 1].push(index); used += block.height
  })
  return pages
}

/** Native DOM/OOXML implementation, with no embedded third-party editor. */
export const createDocxEngine: WordEngineFactory = async (host, bytes, readOnly, signal) => {
  const model = new DocxDocument(new Uint8Array(bytes))
  const doc = host.ownerDocument
  let locked = readOnly || model.locked
  let destroyed = false
  let composing = false
  let selected = 0
  let start = 0
  let end = 0
  let crossParagraphSelection = false
  let change = (): void => {}
  let style = (_value: DocxStyle): void => {}
  let history = [model.snapshot()]
  let historyIndex = 0
  let rendered = new Map<Element, HTMLElement>()
  let indices = new Map<Element, number>()
  const urls: string[] = []
  const imageUrls = new Map<string, string>()
  const rels = new Map<string, string>()
  const imageTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }
  const relBytes = model.entries['word/_rels/document.xml.rels']
  if (relBytes) {
    const { parseXml } = await import('./document_session.ts')
    const tree = parseXml(new TextDecoder().decode(relBytes), new DOMParser())
    for (const rel of Array.from(tree.getElementsByTagNameNS('*', 'Relationship'))) {
      if (rel.getAttribute('TargetMode') === 'External') { continue }
      const url = new URL(rel.getAttribute('Target') || '', 'https://package.local/word/document.xml')
      if (url.origin === 'https://package.local' && !url.search && !url.hash && /\/image$/.test(rel.getAttribute('Type') || '')) { rels.set(rel.getAttribute('Id') || '', decodeURIComponent(url.pathname.slice(1))) }
    }
  }
  const active = (): Element | undefined => model.paragraphs[selected]
  const capture = (): void => {
    const selection = doc.getSelection?.()
    if (!selection?.rangeCount) { return }
    const range = selection.getRangeAt(0)
    for (const [xml, element] of rendered) {
      if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) { continue }
      const before = range.cloneRange(); before.selectNodeContents(element); before.setEnd(range.startContainer, range.startOffset)
      selected = indices.get(xml) ?? 0; start = before.toString().length; end = start + range.toString().length
      crossParagraphSelection = false
      style(model.styleAt(xml, start))
      return
    }
    const elements = Array.from(rendered.values())
    if (elements.some(element => element.contains(range.startContainer)) && elements.some(element => element.contains(range.endContainer))) { crossParagraphSelection = true }
  }
  const commit = (): void => {
    const snapshot = model.snapshot()
    if (snapshot === history[historyIndex]) { return }
    history = history.slice(0, historyIndex + 1); history.push(snapshot)
    // Bound history memory as well as the number of undo steps.
    let size = history.reduce((sum, value) => sum + value.length * 2, 0)
    while (history.length > 1 && (history.length > 50 || size > 16 * 1024 * 1024)) { size -= history.shift()!.length * 2 }
    historyIndex = history.length - 1
    change()
  }
  const applyStyle = (element: HTMLElement, value: DocxStyle): void => {
    element.style.fontFamily = value.font || 'DengXian, sans-serif'
    element.style.fontSize = (value.size || 16) + 'px'
    element.style.fontWeight = value.bold ? '700' : '400'
    element.style.fontStyle = value.italic ? 'italic' : 'normal'
    element.style.textDecoration = value.underline ? 'underline' : 'none'
    element.style.color = value.color || '#111111'
  }
  const object = (parent: HTMLElement, label: string): void => {
    const node = doc.createElement('span'); node.setAttribute('data-docx-object', ''); node.textContent = label; parent.append(node)
  }
  const drawImage = (node: Element, parent: HTMLElement): boolean => {
    let found = false
    for (const blip of Array.from(node.getElementsByTagNameNS('*', 'blip'))) {
      const id = Array.from(blip.attributes).find(attr => attr.localName === 'embed')?.value || ''
      const path = rels.get(id)
      const data = path && model.entries[path]
      const type = path && imageTypes[path.split('.').pop()!.toLowerCase()]
      if (!data || !type) { continue }
      let url = imageUrls.get(path!)
      if (!url) { const copy = new Uint8Array(data); url = URL.createObjectURL(new Blob([copy.buffer], { type })); urls.push(url); imageUrls.set(path!, url) }
      const image = doc.createElement('img'); image.src = url; image.alt = '文档内嵌图片'
      const extent = node.getElementsByTagNameNS('*', 'extent')[0]
      const width = Number(extent?.getAttribute('cx')) / 9525
      if (width > 0) { image.style.width = Math.min(1600, width) + 'px' }
      image.style.maxWidth = '100%'; image.style.height = 'auto'
      image.addEventListener('load', () => { if (!destroyed && !composing && !host.contains(doc.activeElement)) { paginate() } }, { once: true })
      parent.append(image); found = true
    }
    return found
  }
  const paragraph = (p: Element): HTMLElement => {
    const element = doc.createElement('div')
    element.setAttribute('data-docx-paragraph', '')
    const value = model.style(p)
    applyStyle(element, value)
    element.style.textAlign = value.align || 'start'; element.style.lineHeight = String(value.spacing || 1.5)
    element.style.marginTop = (value.before || 0) + 'px'; element.style.marginBottom = (value.after ?? 8) + 'px'
    const editable = model.editable(p)
    element.setAttribute('contenteditable', editable && !locked ? 'plaintext-only' : 'false')
    element.setAttribute('role', 'textbox'); element.setAttribute('aria-label', '文档段落 ' + ((indices.get(p) ?? 0) + 1))
    element.setAttribute('aria-readonly', String(!editable || locked))
    if (!editable) { element.title = '包含复杂对象，第一阶段只读显示并保留原始数据。' }
    const renderInline = (node: Element, parent: HTMLElement, run?: Element): void => {
      if (node.namespaceURI !== model.ns) { if (!drawImage(node, parent)) { object(parent, '[对象暂不支持显示]') }; return }
      if (node.localName === 'pPr' || node.localName === 'rPr') { return }
      if (node.localName === 't') { const span = doc.createElement('span'); span.textContent = node.textContent; applyStyle(span, model.style(p, run)); parent.append(span); return }
      if (node.localName === 'tab') { const span = doc.createElement('span'); span.textContent = '\t'; parent.append(span); return }
      if (node.localName === 'br' || node.localName === 'cr') { parent.append(doc.createElement('br')); return }
      if (['drawing', 'pict', 'object'].includes(node.localName)) { if (!drawImage(node, parent)) { object(parent, '[绘图对象已保留]') }; return }
      if (['bookmarkStart', 'bookmarkEnd', 'proofErr', 'fldChar', 'instrText'].includes(node.localName)) { return }
      if (node.localName === 'del') { object(parent, '[删除修订已保留]'); return }
      for (const child of model.children(node)) { renderInline(child, parent, node.localName === 'r' ? node : run) }
    }
    for (const node of model.children(p)) { renderInline(node, element) }
    rendered.set(p, element)
    element.addEventListener('focus', () => { selected = indices.get(p) ?? 0; start = end = 0; crossParagraphSelection = false; style(model.styleAt(p)) })
    element.addEventListener('compositionstart', () => { composing = true })
    element.addEventListener('compositionend', () => { composing = false; update() })
    const update = (): void => {
      if (locked || !editable || composing) { return }
      try { model.setText(p, element.textContent || ''); selected = indices.get(p) ?? 0; capture(); commit() }
      catch { element.textContent = model.text(p) }
    }
    element.addEventListener('input', update)
    element.addEventListener('beforeinput', event => {
      if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') { event.preventDefault(); engine.run(event.inputType === 'historyUndo' ? 'undo' : 'redo'); return }
      if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
        event.preventDefault()
        if (locked || !editable || composing || event.isComposing) { return }
        capture()
        if (crossParagraphSelection) { return }
        if (start !== end) { const text = model.text(p); model.setText(p, text.slice(0, start) + text.slice(end)) }
        const next = model.split(p, start); selected = model.paragraphs.indexOf(next); start = end = 0
        commit(); render(); focusSelection()
      }
    })
    element.addEventListener('paste', event => {
      if (locked || !editable) { return }
      event.preventDefault(); capture()
      if (crossParagraphSelection) { return }
      const inserted = event.clipboardData?.getData('text/plain').replace(/[\r\n]+/g, ' ') || ''
      const text = model.text(p)
      try { model.setText(p, text.slice(0, start) + inserted + text.slice(end)); start += inserted.length; end = start; commit(); render(); focusSelection() } catch { /* Reject unsupported control characters. */ }
    })
    element.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault(); engine.run(event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo')
      }
      // Browser formatting would modify HTML without updating OOXML.
      if ((event.ctrlKey || event.metaKey) && !event.altKey && ['b', 'i', 'u'].includes(event.key.toLowerCase())) {
        event.preventDefault(); engine.run(event.key.toLowerCase() === 'b' ? 'bold' : event.key.toLowerCase() === 'i' ? 'italic' : 'underline')
      }
    })
    element.addEventListener('blur', () => { if (!destroyed && !composing) { paginate() } })
    return element
  }
  const block = (node: Element, depth = 0): HTMLElement => {
    if (node.namespaceURI === model.ns && node.localName === 'p') { return paragraph(node) }
    if (node.namespaceURI === model.ns && node.localName === 'tbl' && depth < 8) {
      const table = doc.createElement('table'); table.setAttribute('data-docx-table', '')
      for (const row of model.children(node).filter(child => child.localName === 'tr')) {
        const tr = doc.createElement('tr')
        for (const cell of model.children(row).filter(child => child.localName === 'tc')) {
          const td = doc.createElement('td')
          const pr = model.child(cell, 'tcPr'); const span = pr && model.child(pr, 'gridSpan')
          td.colSpan = Math.max(1, Math.min(100, Number(model.attr(span, 'val')) || 1))
          for (const child of model.children(cell).filter(child => child.localName !== 'tcPr')) { td.append(block(child, depth + 1)) }
          tr.append(td)
        }
        table.append(tr)
      }
      return table
    }
    const placeholder = doc.createElement('div'); object(placeholder, '[此文档对象暂不支持显示，原始数据已保留]'); return placeholder
  }
  let blocks: HTMLElement[] = []
  let breaks: boolean[] = []
  const page = (): HTMLElement => {
    const node = doc.createElement('section'); node.setAttribute('data-docx-page', '')
    const layout = model.layout
    node.style.width = layout.width + 'px'; node.style.minHeight = layout.height + 'px'
    node.style.padding = layout.margins.map(value => value + 'px').join(' ')
    node.setAttribute('aria-label', '文档页面'); return node
  }
  const paginate = (): void => {
    if (destroyed || composing || !blocks.length) { return }
    const heights = blocks.map((element, index) => {
      const css = doc.defaultView?.getComputedStyle(element)
      return { height: Math.max(24, element.offsetHeight || 24) + (parseFloat(css?.marginTop || '0') || 0) + (parseFloat(css?.marginBottom || '0') || 0), breakBefore: breaks[index] }
    })
    const layout = model.layout
    const groups = docxPageGroups(heights, Math.max(80, layout.height - layout.margins[0] - layout.margins[2]))
    const pages = groups.map(() => page())
    groups.forEach((group, index) => { for (const item of group) { pages[index].append(blocks[item]) } })
    for (const child of Array.from(host.children)) { child.remove() }
    host.append(...pages)
  }
  const render = (): void => {
    rendered = new Map()
    indices = new Map(model.paragraphs.map((p, index) => [p, index]))
    for (const child of Array.from(host.children)) { child.remove() }
    const nodes = model.children(model.body).filter(node => node.localName !== 'sectPr')
    blocks = nodes.map(node => block(node)); breaks = nodes.map(node => node.localName === 'p' && Boolean(model.style(node).pageBreak))
    const first = page(); first.append(...blocks); host.append(first); paginate()
  }
  const focusSelection = (): void => {
    const xml = active(); const element = xml && rendered.get(xml)
    if (!element) { return }
    const from = start; const to = end
    element.focus(); start = from; end = to
    const selection = doc.getSelection?.()
    if (!selection || !doc.createRange || !doc.createTreeWalker) { return }
    const nodes: Text[] = []
    const walker = doc.createTreeWalker(element, 4)
    let item: Node | null
    while ((item = walker.nextNode())) { nodes.push(item as Text) }
    const point = (offset: number): [Node, number] => {
      for (const node of nodes) { if (offset <= node.length) { return [node, offset] }; offset -= node.length }
      return nodes.length ? [nodes[nodes.length - 1], nodes[nodes.length - 1].length] : [element, 0]
    }
    const range = doc.createRange(); range.setStart(...point(start)); range.setEnd(...point(end)); selection.removeAllRanges(); selection.addRange(range)
  }
  const engine: WordEngine = {
    supports: command => commands.has(command),
    value: () => ({ data: model.snapshot(), options: model.layout }),
    mode (readOnly) {
      locked = readOnly || model.locked
      for (const [xml, element] of rendered) { const editable = !locked && model.editable(xml); element.setAttribute('contenteditable', editable ? 'plaintext-only' : 'false'); element.setAttribute('aria-readonly', String(!editable)) }
    },
    run (command, value) {
      if (locked || destroyed || !commands.has(command)) { return }
      capture()
      if (crossParagraphSelection && !['undo', 'redo', 'portrait', 'landscape', 'margins'].includes(command)) { throw new Error('第一阶段请只选择一个段落内的文字进行编辑。') }
      if (command === 'undo' || command === 'redo') {
        const next = historyIndex + (command === 'undo' ? -1 : 1)
        if (next < 0 || next >= history.length) { return }
        historyIndex = next; model.restore(history[next]); change()
      } else {
        if (['portrait', 'landscape', 'margins'].includes(command)) { model.setLayout(command, value) }
        else { const xml = active(); if (!xml) { return }; model.format(xml, command, value, start, end) }
        commit()
      }
      render(); focusSelection()
      const xml = active(); if (xml) { style(model.styleAt(xml, start)) }
    },
    exportBytes: () => model.exportBytes(),
    async exportCopy (name) {
      const bytes = model.exportBytes(); const copy = new Uint8Array(bytes)
      const url = URL.createObjectURL(new Blob([copy.buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
      const link = doc.createElement('a'); link.href = url; link.download = name; doc.body.append(link); link.click(); link.remove()
      doc.defaultView?.setTimeout(() => URL.revokeObjectURL(url), 60000)
    },
    subscribe (onChange, onStyle) { change = onChange; style = onStyle; return () => { change = () => {}; style = () => {} } },
    destroy () {
      if (destroyed) { return }
      destroyed = true; doc.removeEventListener('selectionchange', capture); signal?.removeEventListener('abort', engine.destroy)
      for (const url of urls) { URL.revokeObjectURL(url) }
      history = []; rendered.clear(); blocks = []; for (const child of Array.from(host.children)) { child.remove() }
    }
  }
  if (signal?.aborted) { engine.destroy(); throw new Error('文档加载已取消。') }
  signal?.addEventListener('abort', engine.destroy, { once: true })
  doc.addEventListener('selectionchange', capture)
  try { render() } catch (error) { engine.destroy(); throw error }
  return engine
}
