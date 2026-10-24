import { strFromU8, strToU8, zipSync } from 'fflate'
import { createSession, openOfficePackage, parseXml, paragraphNodes, replaceText } from './document_session.ts'
import type { DocumentField, DocumentSession } from './document_session.ts'

const spreadsheetNamespaces = ['http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'http://purl.oclc.org/ooxml/spreadsheetml/main']
const drawingNamespaces = ['http://schemas.openxmlformats.org/drawingml/2006/main', 'http://purl.oclc.org/ooxml/drawingml/main']
const relationshipNamespaces = ['http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'http://purl.oclc.org/ooxml/officeDocument/relationships']

function xmlPart (entries: Record<string, Uint8Array>, path: string, parser: DOMParser): XMLDocument {
  const bytes = entries[path]
  if (!bytes || bytes.length > 4 * 1024 * 1024) { throw new Error('Office 文件部件不存在或体积过大：' + path) }
  return parseXml(strFromU8(bytes), parser)
}

function relationships (entries: Record<string, Uint8Array>, part: string, parser: DOMParser): Map<string, { path: string, type: string }> {
  const slash = part.lastIndexOf('/')
  const path = part.slice(0, slash + 1) + '_rels/' + part.slice(slash + 1) + '.rels'
  const xml = xmlPart(entries, path, parser)
  const result = new Map<string, { path: string, type: string }>()
  for (const node of Array.from(xml.getElementsByTagNameNS('*', 'Relationship'))) {
    if (node.getAttribute('TargetMode') === 'External') { continue }
    const target = new URL(node.getAttribute('Target') || '', 'https://package.local/' + part)
    if (target.origin !== 'https://package.local' || target.search || target.hash) { continue }
    const id = node.getAttribute('Id') || ''
    if (result.has(id)) { throw new Error('Office 文件包含重复关系。') }
    result.set(id, { path: target.pathname.slice(1), type: node.getAttribute('Type') || '' })
  }
  return result
}

function relationId (node: Element): string {
  return relationshipNamespaces.map(ns => node.getAttributeNS(ns, 'id')).find(Boolean) || ''
}

function validateOfficeText (value: string): void {
  for (const char of value) {
    const point = char.codePointAt(0)!
    if (point < 0x20 && ![9, 10, 13].includes(point) || point >= 0xD800 && point <= 0xDFFF || point === 0xFFFE || point === 0xFFFF) {
      throw new Error('内容包含不能写入 Office 文件的控制字符。')
    }
  }
}

export function cellCoordinate (address: string): { row: number, column: number } {
  const match = /^([A-Z]{1,3})([1-9]\d{0,6})$/i.exec(address)
  if (!match) { throw new Error('无效单元格地址：' + address) }
  let column = 0
  for (const letter of match[1].toUpperCase()) { column = column * 26 + letter.charCodeAt(0) - 64 }
  const row = Number(match[2])
  if (row > 1048576 || column > 16384) { throw new Error('单元格超出 Excel 的支持范围。') }
  return { row, column }
}

export function columnLabel (column: number): string {
  let result = ''
  while (column > 0) { column--; result = String.fromCharCode(65 + column % 26) + result; column = Math.floor(column / 26) }
  return result
}

export function openXlsxDocument (bytes: Uint8Array, parser = new DOMParser(), serializer = new XMLSerializer()): DocumentSession {
  const entries = openOfficePackage(bytes)
  const workbook = xmlPart(entries, 'xl/workbook.xml', parser)
  const ns = workbook.documentElement.namespaceURI || ''
  if (!spreadsheetNamespaces.includes(ns)) { throw new Error('文件不是有效的 XLSX 工作簿。') }
  const rels = relationships(entries, 'xl/workbook.xml', parser)
  const sharedPath = Array.from(rels.values()).find(rel => rel.type.endsWith('/sharedStrings'))?.path || 'xl/sharedStrings.xml'
  const shared = entries[sharedPath] ? Array.from(xmlPart(entries, sharedPath, parser).getElementsByTagNameNS(ns, 'si')).map(node => (
    Array.from(node.getElementsByTagNameNS(ns, 't')).filter(text => (text.parentNode as Element | null)?.localName !== 'rPh').map(text => text.textContent || '').join('')
  )) : []
  const signed = Object.keys(entries).some(path => path.startsWith('_xmlsignatures/'))
  const fields: DocumentField[] = []
  const cells: Array<{ path: string, address: string, type: string }> = []
  const groups = new Set<string>()
  const sheetPaths = new Set<string>()
  for (const sheet of Array.from(workbook.getElementsByTagNameNS(ns, 'sheet'))) {
    const rel = rels.get(relationId(sheet))
    if (!rel) { throw new Error('工作表关系无效，不能加载外部工作表。') }
    if (!rel.type.endsWith('/worksheet')) { continue }
    if (sheetPaths.has(rel.path)) { throw new Error('工作表部件重复，无法安全编辑。') }
    sheetPaths.add(rel.path)
    const group = sheet.getAttribute('name') || '工作表 ' + (groups.size + 1)
    if (groups.has(group)) { throw new Error('工作表名称重复。') }
    groups.add(group)
    const xml = xmlPart(entries, rel.path, parser)
    const sheetNs = xml.documentElement.namespaceURI || ''
    if (sheetNs !== ns || xml.documentElement.localName !== 'worksheet') { throw new Error('工作表格式不受支持。') }
    const protectedSheet = signed || xml.getElementsByTagNameNS(ns, 'sheetProtection').length > 0
    const arrayRanges = Array.from(xml.getElementsByTagNameNS(ns, 'f')).filter(node => ['array', 'dataTable'].includes(node.getAttribute('t') || '')).map(node => {
      const range = (node.getAttribute('ref') || (node.parentNode as Element | null)?.getAttribute('r') || '').split(':')
      return [cellCoordinate(range[0]), cellCoordinate(range[1] || range[0])]
    })
    const addresses = new Set<string>()
    for (const cell of Array.from(xml.getElementsByTagNameNS(ns, 'c'))) {
      if ((cell.parentNode as Element | null)?.localName !== 'row') { continue }
      const address = (cell.getAttribute('r') || '').toUpperCase()
      const coordinate = cellCoordinate(address)
      if (addresses.has(address)) { throw new Error('工作表包含重复单元格。') }
      addresses.add(address)
      const formula = cell.getElementsByTagNameNS(ns, 'f')[0]
      const type = cell.getAttribute('t') || 'n'
      const raw = cell.getElementsByTagNameNS(ns, 'v')[0]?.textContent || ''
      let value = raw
      if (type === 's') {
        if (!/^\d+$/.test(raw) || shared[Number(raw)] === undefined) { throw new Error('共享字符串索引无效。') }
        value = shared[Number(raw)]
      } else if (type === 'inlineStr') { value = Array.from(cell.getElementsByTagNameNS(ns, 't')).map(text => text.textContent || '').join('') } else if (type === 'b') { value = raw === '1' ? 'true' : 'false' }
      if (formula) { value = '=' + (formula.textContent || '') }
      const arrayCell = arrayRanges.some(([start, end]) => coordinate.row >= start.row && coordinate.row <= end.row && coordinate.column >= start.column && coordinate.column <= end.column)
      fields.push({ label: group + ' · ' + address, group, value, ...coordinate, readOnly: protectedSheet || Boolean(formula) || arrayCell, multiline: value.includes('\n') })
      cells.push({ path: rel.path, address, type })
      if (fields.length > 10000) { throw new Error('现有单元格超过 10000 个，请使用桌面表格编辑器。') }
    }
  }
  const initial = fields.map(field => field.value)
  return createSession(fields, fields.some(field => !field.readOnly), '表格基础编辑：显示原始单元格值，可修改已有单元格。公式及受保护区域只读，浏览器不计算公式；Excel 打开副本时会重新计算。图表、格式及其他文件资源保留，不写回原服务器。', () => {
    const changed = fields.map((field, index) => field.value !== initial[index] ? index : -1).filter(index => index >= 0)
    if (!changed.length) { return bytes.slice() }
    const result = { ...entries }
    const parts = new Map<string, XMLDocument>()
    for (const index of changed) {
      const info = cells[index]
      let xml = parts.get(info.path)
      if (!xml) { xml = xmlPart(entries, info.path, parser); parts.set(info.path, xml) }
      const cell = Array.from(xml.getElementsByTagNameNS(ns, 'c')).find(node => (node.getAttribute('r') || '').toUpperCase() === info.address)!
      for (const child of Array.from(cell.childNodes)) {
        if (child.nodeType === 1 && ['v', 'is'].includes((child as Element).localName)) { cell.removeChild(child) }
      }
      const value = fields[index].value
      cell.removeAttribute('t')
      if (value === '') { continue }
      const create = (tag: string): Element => xml!.createElementNS(ns, (cell.prefix ? cell.prefix + ':' : '') + tag)
      let node: Element
      if (info.type === 'n' && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value) && Number.isFinite(Number(value))) {
        node = create('v'); node.textContent = value
      } else if (info.type === 'b' && ['true', 'false', '1', '0'].includes(value)) {
        cell.setAttribute('t', 'b'); node = create('v'); node.textContent = ['true', '1'].includes(value) ? '1' : '0'
      } else {
        cell.setAttribute('t', 'inlineStr'); node = create('is')
        const text = create('t'); text.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); text.textContent = value; node.appendChild(text)
      }
      const extension = Array.from(cell.childNodes).find(child => child.nodeType === 1 && (child as Element).localName === 'extLst')
      cell.insertBefore(node, extension || null)
    }
    for (const [path, xml] of parts) { result[path] = strToU8(serializer.serializeToString(xml)) }
    const book = xmlPart(entries, 'xl/workbook.xml', parser)
    let calc = book.getElementsByTagNameNS(ns, 'calcPr')[0]
    if (!calc) {
      calc = book.createElementNS(ns, (book.documentElement.prefix ? book.documentElement.prefix + ':' : '') + 'calcPr')
      const following = ['oleSize', 'customWorkbookViews', 'pivotCaches', 'smartTagPr', 'smartTagTypes', 'webPublishing', 'fileRecoveryPr', 'webPublishObjects', 'extLst']
      const next = Array.from(book.documentElement.childNodes).find(node => node.nodeType === 1 && following.includes((node as Element).localName))
      book.documentElement.insertBefore(calc, next || null)
    }
    calc.setAttribute('fullCalcOnLoad', '1'); calc.setAttribute('forceFullCalc', '1'); calc.setAttribute('calcMode', 'auto')
    result['xl/workbook.xml'] = strToU8(serializer.serializeToString(book))
    return zipSync(result, { level: 3 })
  }, false, validateOfficeText)
}

export function openPptxDocument (bytes: Uint8Array, parser = new DOMParser(), serializer = new XMLSerializer()): DocumentSession {
  const entries = openOfficePackage(bytes)
  const presentation = xmlPart(entries, 'ppt/presentation.xml', parser)
  const ns = presentation.documentElement.namespaceURI || ''
  if (!['http://schemas.openxmlformats.org/presentationml/2006/main', 'http://purl.oclc.org/ooxml/presentationml/main'].includes(ns)) { throw new Error('文件不是有效的 PowerPoint 演示文稿。') }
  const rels = relationships(entries, 'ppt/presentation.xml', parser)
  const locked = Object.keys(entries).some(path => path.startsWith('_xmlsignatures/')) || presentation.getElementsByTagNameNS(ns, 'modifyVerifier').length > 0
  const fields: DocumentField[] = []
  const targets: Array<{ path: string, index: number, namespace: string }> = []
  const slides = Array.from(presentation.getElementsByTagNameNS(ns, 'sldId'))
  const slidePaths = new Set<string>()
  if (slides.length > 300) { throw new Error('幻灯片超过 300 页，请在桌面演示文稿编辑器中打开。') }
  slides.forEach((slide, slideIndex) => {
    const rel = rels.get(relationId(slide))
    if (!rel || !rel.type.endsWith('/slide')) { throw new Error('幻灯片关系无效。') }
    if (slidePaths.has(rel.path)) { throw new Error('幻灯片部件重复，无法安全编辑。') }
    slidePaths.add(rel.path)
    const xml = xmlPart(entries, rel.path, parser)
    const drawing = drawingNamespaces.find(namespace => xml.getElementsByTagNameNS(namespace, 'p').length) || drawingNamespaces[0]
    const paragraphs = paragraphNodes(xml, drawing)
    const group = '幻灯片 ' + (slideIndex + 1)
    if (!paragraphs.length) {
      fields.push({ label: group, group, value: '此页没有可编辑文字（图像、母版或媒体内容不在文本预览中显示）。', readOnly: true })
      targets.push({ path: rel.path, index: -1, namespace: drawing })
    }
    paragraphs.forEach((nodes, index) => {
      fields.push({ label: group + ' · 文本段落 ' + (index + 1), group, value: nodes.map(node => node.textContent || '').join(''), readOnly: locked })
      targets.push({ path: rel.path, index, namespace: drawing })
    })
    if (fields.length > 5000) { throw new Error('幻灯片文字段落过多，请在桌面编辑器中打开。') }
  })
  const initial = fields.map(field => field.value)
  return createSession(fields, fields.some(field => !field.readOnly), 'PowerPoint 文字编辑：按幻灯片顺序修改已有文本。这里不渲染完整幻灯片画面，不编辑布局、动画或图表；下载副本保留其他资源，受保护或签名文件只读。', () => {
    const changed = fields.map((field, index) => field.value !== initial[index] ? index : -1).filter(index => index >= 0)
    if (!changed.length) { return bytes.slice() }
    const result = { ...entries }
    const parts = new Map<string, XMLDocument>()
    for (const index of changed) {
      const target = targets[index]
      if (target.index < 0) { continue }
      let xml = parts.get(target.path)
      if (!xml) { xml = xmlPart(entries, target.path, parser); parts.set(target.path, xml) }
      replaceText(paragraphNodes(xml, target.namespace)[target.index], fields[index].value)
    }
    for (const [path, xml] of parts) { result[path] = strToU8(serializer.serializeToString(xml)) }
    return zipSync(result, { level: 3 })
  }, true)
}
