import { strFromU8, strToU8, zipSync } from 'fflate'
import { openOfficePackage, parseXml, replaceText } from './document_session.ts'

export interface DocxStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  font?: string
  size?: number
  color?: string
  align?: string
  spacing?: number
  before?: number
  after?: number
  pageBreak?: boolean
}

/** Owned OOXML model. Preserve the package and mutate only supported XML nodes. */
export class DocxDocument {
  readonly entries: Record<string, Uint8Array>
  readonly locked: boolean
  readonly ns: string
  xml: XMLDocument
  private parser: DOMParser
  private serializer: XMLSerializer
  private original: Uint8Array
  private initial: string
  private styles = new Map<string, Element>()
  private defaults: DocxStyle = { font: 'DengXian', size: 16 }

  constructor (bytes: Uint8Array, parser = new DOMParser(), serializer = new XMLSerializer()) {
    this.entries = openOfficePackage(bytes)
    this.parser = parser; this.serializer = serializer; this.original = bytes.slice()
    const main = this.entries['word/document.xml']
    if (!main || main.length > 4 * 1024 * 1024) { throw new Error('这不是受支持的 DOCX 文档，或正文体积过大。') }
    this.xml = parseXml(strFromU8(main), parser)
    this.ns = this.xml.documentElement.namespaceURI!
    if (!['http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'http://purl.oclc.org/ooxml/wordprocessingml/main'].includes(this.ns) || this.xml.documentElement.localName !== 'document' || !this.body) { throw new Error('文档不是有效的 Word 正文。') }
    if (this.paragraphs.length > 5000) { throw new Error('正文段落过多，请在桌面文档编辑器中打开。') }
    const settings = this.entries['word/settings.xml']
    const protection = settings ? Array.from(parseXml(strFromU8(settings), parser).getElementsByTagNameNS(this.ns, 'documentProtection')) : []
    this.locked = protection.some(node => ['1', 'true', 'on'].includes(this.attr(node, 'enforcement'))) || Object.keys(this.entries).some(name => name.startsWith('_xmlsignatures/'))
    const styles = this.entries['word/styles.xml']
    if (styles) {
      const tree = parseXml(strFromU8(styles), parser)
      for (const style of Array.from(tree.getElementsByTagNameNS(this.ns, 'style'))) { this.styles.set(this.attr(style, 'styleId'), style) }
      const defaults = tree.getElementsByTagNameNS(this.ns, 'docDefaults')[0]
      if (defaults) {
        this.defaults = { ...this.defaults, ...this.readProperties(defaults.getElementsByTagNameNS(this.ns, 'rPr')[0]), ...this.readProperties(defaults.getElementsByTagNameNS(this.ns, 'pPr')[0]) }
      }
      const normal = Array.from(this.styles.values()).find(style => this.attr(style, 'type') === 'paragraph' && this.attr(style, 'default') === '1')
      if (normal) { this.defaults = { ...this.defaults, ...this.namedStyle(this.attr(normal, 'styleId')) } }
    }
    this.initial = this.snapshot()
  }

  children (parent: Node): Element[] { return Array.from(parent.childNodes).filter(node => node.nodeType === 1) as Element[] }
  child (parent: Node, name: string): Element | undefined { return this.children(parent).find(node => node.namespaceURI === this.ns && node.localName === name) }
  attr (node: Element | undefined, name: string): string { return node?.getAttributeNS(this.ns, name) || '' }
  get body (): Element { return this.child(this.xml.documentElement, 'body')! }
  get paragraphs (): Element[] { return Array.from(this.body.getElementsByTagNameNS(this.ns, 'p')) }
  snapshot (): string { return this.serializer.serializeToString(this.xml) }
  restore (source: string): void { this.guard(); this.xml = parseXml(source, this.parser) }
  private guard (): void { if (this.locked) { throw new Error('文档受保护，只读显示。') } }
  private element (name: string): Element { return this.xml.createElementNS(this.ns, (this.xml.documentElement.prefix ? this.xml.documentElement.prefix + ':' : '') + name) }
  private property (parent: Element, name: string): Element {
    let node = this.child(parent, name)
    if (!node) {
      node = this.element(name)
      const orders: Record<string, string[]> = {
        p: ['pPr'], r: ['rPr'],
        pPr: ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl', 'numPr', 'suppressLineNumbers', 'pBdr', 'shd', 'tabs', 'suppressAutoHyphens', 'kinsoku', 'wordWrap', 'overflowPunct', 'topLinePunct', 'autoSpaceDE', 'autoSpaceDN', 'bidi', 'adjustRightInd', 'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'],
        rPr: ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline', 'shadow', 'emboss', 'imprint', 'noProof', 'snapToGrid', 'vanish', 'webHidden', 'color', 'spacing', 'w', 'kern', 'position', 'sz', 'szCs', 'highlight', 'u', 'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath', 'rPrChange'],
        sectPr: ['headerReference', 'footerReference', 'footnotePr', 'endnotePr', 'type', 'pgSz', 'pgMar', 'paperSrc', 'pgBorders', 'lnNumType', 'pgNumType', 'cols', 'formProt', 'vAlign', 'noEndnote', 'titlePg', 'textDirection', 'bidi', 'rtlGutter', 'docGrid', 'printerSettings', 'sectPrChange']
      }
      const order = orders[parent.localName] || []
      const index = order.indexOf(name)
      const before = ['p', 'r'].includes(parent.localName) ? parent.firstChild : this.children(parent).find(child => order.indexOf(child.localName) > index)
      parent.insertBefore(node, before || null)
    }
    return node
  }
  private set (node: Element, name: string, value: string): void {
    node.setAttributeNS(this.ns, (this.xml.documentElement.prefix ? this.xml.documentElement.prefix + ':' : '') + name, value)
  }
  private readProperties (pr?: Element): DocxStyle {
    if (!pr) { return {} }
    const result: DocxStyle = {}
    for (const [name, key] of [['b', 'bold'], ['i', 'italic'], ['u', 'underline']] as const) {
      const node = this.child(pr, name)
      if (node) { result[key] = !['0', 'false', 'off', 'none'].includes(this.attr(node, 'val')) }
    }
    const fonts = this.child(pr, 'rFonts')
    if (fonts) { result.font = this.attr(fonts, 'eastAsia') || this.attr(fonts, 'ascii') || this.attr(fonts, 'hAnsi') || undefined }
    const size = Number(this.attr(this.child(pr, 'sz'), 'val'))
    if (size > 0) { result.size = Math.min(400, size * 2 / 3) }
    const color = this.attr(this.child(pr, 'color'), 'val')
    if (/^[\da-f]{6}$/i.test(color)) { result.color = '#' + color }
    const align = this.attr(this.child(pr, 'jc'), 'val')
    if (['left', 'right', 'center', 'both', 'start', 'end'].includes(align)) { result.align = align === 'both' ? 'justify' : align }
    const spacing = this.child(pr, 'spacing')
    if (spacing) {
      const line = Number(this.attr(spacing, 'line'))
      if (line && (!this.attr(spacing, 'lineRule') || this.attr(spacing, 'lineRule') === 'auto')) { result.spacing = Math.max(0.5, Math.min(5, line / 240)) }
      for (const key of ['before', 'after'] as const) { if (spacing.hasAttributeNS(this.ns, key)) { result[key] = Math.max(0, Math.min(300, Number(this.attr(spacing, key)) / 15)) } }
    }
    const pageBreak = this.child(pr, 'pageBreakBefore')
    if (pageBreak) { result.pageBreak = !['0', 'false', 'off'].includes(this.attr(pageBreak, 'val')) }
    return result
  }
  private namedStyle (id: string, visited = new Set<string>()): DocxStyle {
    if (visited.has(id) || visited.size > 20) { return {} }
    visited.add(id)
    const node = this.styles.get(id)
    if (!node) { return {} }
    return { ...this.namedStyle(this.attr(this.child(node, 'basedOn'), 'val'), visited), ...this.readProperties(this.child(node, 'pPr')), ...this.readProperties(this.child(node, 'rPr')) }
  }
  style (paragraph: Element, run?: Element): DocxStyle {
    const pr = this.child(paragraph, 'pPr')
    const rp = run && this.child(run, 'rPr')
    return { ...this.defaults, ...this.namedStyle(this.attr(pr && this.child(pr, 'pStyle'), 'val')),
      ...this.readProperties(pr), ...this.readProperties(pr && this.child(pr, 'rPr')),
      ...this.namedStyle(this.attr(rp && this.child(rp, 'rStyle'), 'val')), ...this.readProperties(rp) }
  }
  styleAt (paragraph: Element, offset = 0): DocxStyle {
    let position = 0
    const run = this.children(paragraph).filter(node => node.localName === 'r').find(node => { position += this.text(node).length; return position > offset })
    return this.style(paragraph, run || this.child(paragraph, 'r'))
  }
  text (paragraph: Element): string {
    return Array.from(paragraph.getElementsByTagNameNS(this.ns, 't')).map(node => node.textContent || '').join('')
  }
  editable (p: Element): boolean {
    // Complex fields, links, tracked changes, drawings and controls are retained,
    // but cannot be rewritten by the first-stage plain paragraph editor.
    return !this.locked && this.children(p).every(node => node.namespaceURI === this.ns && (
      ['pPr', 'bookmarkStart', 'bookmarkEnd', 'proofErr'].includes(node.localName) ||
      node.localName === 'r' && this.children(node).every(child => child.namespaceURI === this.ns && ['rPr', 't'].includes(child.localName))
    ))
  }
  setText (p: Element, value: string): void {
    this.guard()
    if (!this.editable(p)) { throw new Error('此段落包含暂不支持编辑的对象。') }
    if (/[\r\n\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(value) || /[\uD800-\uDFFF]/u.test(value)) { throw new Error('段落包含不支持的换行或控制字符。') }
    let nodes = Array.from(p.getElementsByTagNameNS(this.ns, 't'))
    if (!nodes.length) { const run = this.element('r'); const text = this.element('t'); run.appendChild(text); p.appendChild(run); nodes = [text] }
    replaceText(nodes, value)
  }
  format (p: Element, command: string, value?: string, start = 0, end = this.text(p).length): void {
    this.guard()
    if (!this.editable(p)) { return }
    if (['left', 'center', 'right', 'justify', 'spacing', 'pageBreak', 'heading'].includes(command)) {
      const pr = this.property(p, 'pPr')
      if (command === 'spacing') {
        const spacing = this.property(pr, 'spacing'); this.set(spacing, 'line', String(Math.round(Number(value) * 240))); this.set(spacing, 'lineRule', 'auto')
      } else if (command === 'pageBreak') {
        const node = this.property(pr, 'pageBreakBefore'); this.set(node, 'val', this.attr(node, 'val') === '1' ? '0' : '1')
      } else if (command === 'heading') {
        const size = value === 'h1' ? 32 : value === 'h2' ? 24 : value === 'h3' ? 20 : 16
        this.format(p, 'size', String(size)); this.format(p, 'bold', value === 'body' ? '0' : '1')
        this.set(this.property(pr, 'outlineLvl'), 'val', value === 'body' ? '9' : value === 'h1' ? '0' : value === 'h2' ? '1' : '2')
      } else { this.set(this.property(pr, 'jc'), 'val', command === 'justify' ? 'both' : command) }
      return
    }
    const styles = this.styleAt(p, start)
    const toggle = command === 'bold' ? styles.bold : command === 'italic' ? styles.italic : styles.underline
    const apply = (run: Element): void => {
      const pr = this.property(run, 'rPr')
      if (['bold', 'italic', 'underline'].includes(command)) {
        const name = command === 'bold' ? 'b' : command === 'italic' ? 'i' : 'u'
        const enabled = value === undefined ? !toggle : value !== '0'
        this.set(this.property(pr, name), 'val', name === 'u' ? enabled ? 'single' : 'none' : enabled ? '1' : '0')
      } else if (command === 'font' && value && value.length <= 100) {
        const fonts = this.property(pr, 'rFonts'); for (const key of ['ascii', 'hAnsi', 'eastAsia', 'cs']) { this.set(fonts, key, value) }
      } else if (command === 'size' && Number(value) >= 4 && Number(value) <= 400) { this.set(this.property(pr, 'sz'), 'val', String(Math.round(Number(value) * 1.5)))
      } else if (command === 'color' && /^#[\da-f]{6}$/i.test(value || '')) { this.set(this.property(pr, 'color'), 'val', value!.slice(1)) }
    }
    if (start === end) { start = 0; end = this.text(p).length }
    if (!this.text(p).length) { this.setText(p, ''); apply(this.child(p, 'r')!); return }
    let offset = 0
    for (const run of this.children(p).filter(node => node.namespaceURI === this.ns && node.localName === 'r')) {
      const text = this.text(run); const next = offset + text.length
      const from = Math.max(0, start - offset); const to = Math.min(text.length, end - offset)
      if (from < to) {
        // Split only simple runs, retaining their attributes and run properties.
        for (const [segment, selected] of [[text.slice(0, from), false], [text.slice(from, to), true], [text.slice(to), false]] as Array<[string, boolean]>) {
          if (!segment) { continue }
          const clone = run.cloneNode(true) as Element
          for (const node of Array.from(clone.getElementsByTagNameNS(this.ns, 't'))) { clone.removeChild(node) }
          const node = this.element('t'); node.textContent = segment; node.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); clone.appendChild(node)
          if (selected) { apply(clone) }
          p.insertBefore(clone, run)
        }
        p.removeChild(run)
      }
      offset = next
    }
  }
  split (p: Element, at: number): Element {
    this.guard()
    if (!this.editable(p)) { throw new Error('此段落不能拆分。') }
    if (this.paragraphs.length >= 5000) { throw new Error('正文已达到 5000 段的编辑上限。') }
    const next = p.cloneNode(true) as Element
    const text = this.text(p)
    this.setText(p, text.slice(0, at)); this.setText(next, text.slice(at))
    // Bookmarks must not acquire duplicate IDs when creating a paragraph.
    for (const node of this.children(next).filter(node => ['bookmarkStart', 'bookmarkEnd'].includes(node.localName))) { next.removeChild(node) }
    for (const name of ['paraId', 'textId']) { for (const attr of Array.from(next.attributes).filter(attr => attr.localName === name)) { next.removeAttributeNode(attr) } }
    p.parentNode!.insertBefore(next, p.nextSibling)
    return next
  }
  get layout (): { width: number, height: number, margins: number[], paperDirection: string } {
    const sect = this.child(this.body, 'sectPr')
    const size = sect && this.child(sect, 'pgSz'); const margin = sect && this.child(sect, 'pgMar')
    const number = (node: Element | undefined, key: string, fallback: number, min: number, max: number): number => {
      const raw = this.attr(node, key); const value = raw ? Number(raw) / 15 : fallback
      return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
    }
    return { width: number(size, 'w', 794, 200, 2400), height: number(size, 'h', 1123, 200, 2400),
      margins: ['top', 'right', 'bottom', 'left'].map(key => number(margin, key, 96, 0, 300)), paperDirection: this.attr(size, 'orient') === 'landscape' ? 'horizontal' : 'vertical' }
  }
  setLayout (command: string, value?: string): void {
    this.guard()
    // A document with multiple sections needs independent per-section layout.
    if (this.xml.getElementsByTagNameNS(this.ns, 'sectPr').length > 1) { throw new Error('多节文档暂不支持更改页面布局。') }
    const before = this.layout; const sect = this.property(this.body, 'sectPr')
    if (sect !== this.body.lastChild) { this.body.appendChild(sect) }
    if (command === 'margins') {
      const margin = this.property(sect, 'pgMar')
      for (const key of ['top', 'right', 'bottom', 'left']) { this.set(margin, key, value === 'narrow' ? '720' : '1440') }
    } else {
      const size = this.property(sect, 'pgSz'); const width = Math.min(before.width, before.height); const height = Math.max(before.width, before.height)
      this.set(size, 'w', String(Math.round((command === 'landscape' ? height : width) * 15)))
      this.set(size, 'h', String(Math.round((command === 'landscape' ? width : height) * 15)))
      this.set(size, 'orient', command === 'landscape' ? 'landscape' : 'portrait')
    }
  }
  exportBytes (): Uint8Array {
    const source = this.snapshot()
    if (source === this.initial) { return this.original.slice() }
    this.guard()
    const main = strToU8(source)
    if (main.length > 4 * 1024 * 1024) { throw new Error('编辑后的正文超过 4 MB，请减少内容后再下载副本。') }
    return zipSync({ ...this.entries, 'word/document.xml': main }, { level: 3 })
  }
}
