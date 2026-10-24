import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

export interface DocumentField {
  label: string
  value: string
  group?: string
  row?: number
  column?: number
  readOnly?: boolean
  multiline?: boolean
}
export interface DocumentSession {
  fields: DocumentField[]
  editable: boolean
  note: string
  dirty: () => boolean
  update: (index: number, value: string) => void
  exportBytes: () => Uint8Array | Promise<Uint8Array>
  markDownloaded: () => void
  locked?: boolean
  downloadCopy?: (filename: string) => Promise<void>
  setEditing?: (enabled: boolean) => void
  setBusy?: (enabled: boolean) => void
  dispose?: () => void
}

const wordNamespaces = ['http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'http://purl.oclc.org/ooxml/wordprocessingml/main']
const maxExpandedBytes = 80 * 1024 * 1024

export function createSession (fields: DocumentField[], editable: boolean, note: string, exportBytes: DocumentSession['exportBytes'], singleLine = false, validate?: (value: string) => void): DocumentSession {
  let downloaded = fields.map(field => field.value)
  return {
    fields, editable, note, exportBytes,
    dirty: () => fields.some((field, index) => field.value !== downloaded[index]),
    update (index, value) {
      if (!editable || !fields[index] || fields[index].readOnly) { throw new Error('该内容不能在此编辑。') }
      if (singleLine && /[\r\n]/.test(value)) { throw new Error('正文编辑支持修改现有段落，不增删换行或段落。') }
      if (singleLine && Array.from(value).some(char => {
        const point = char.codePointAt(0)!
        return point < 0x20 && point !== 0x09 || point >= 0xD800 && point <= 0xDFFF || point === 0xFFFE || point === 0xFFFF
      })) { throw new Error('文字包含不能写入 DOCX 的控制字符。') }
      validate?.(value)
      fields[index].value = value
    },
    markDownloaded () { downloaded = fields.map(field => field.value) }
  }
}

export function openTextDocument (bytes: Uint8Array): DocumentSession {
  if (bytes.length > 2 * 1024 * 1024) { throw new Error('文本文件超过 2 MB，请在另一个页面打开。') }
  const bom = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  const fields = [{ label: '文档正文', value: text }]
  return createSession(fields, true, '编辑仅在当前弹窗中生效；下载副本不会覆盖服务器上的文件。', () => {
    const content = strToU8(fields[0].value)
    if (!bom) { return content }
    const result = new Uint8Array(content.length + 3)
    result.set([0xEF, 0xBB, 0xBF]); result.set(content, 3)
    return result
  })
}

export function parseXml (source: string, parser: DOMParser): XMLDocument {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) { throw new Error('不支持含有 DTD 或自定义实体的文档。') }
  const xml = parser.parseFromString(source, 'application/xml')
  if (!xml.documentElement || xml.getElementsByTagName('parsererror').length) { throw new Error('文档 XML 格式不正确。') }
  return xml
}

export function paragraphNodes (xml: XMLDocument, ns: string): Element[][] {
  return Array.from(xml.getElementsByTagNameNS(ns, 'p')).map(paragraph => (
    Array.from(paragraph.getElementsByTagNameNS(ns, 't')).filter(text => {
      let parent = text.parentNode
      while (parent && parent !== paragraph) {
        if (parent.nodeType === 1 && (parent as Element).namespaceURI === ns && (parent as Element).localName === 'p') { return false }
        parent = parent.parentNode
      }
      return parent === paragraph
    })
  )).filter(nodes => nodes.length > 0)
}

/** Apply the smallest contiguous text edit, retaining unaffected runs and XML. */
export function replaceText (nodes: Element[], value: string): void {
  const texts = nodes.map(node => node.textContent || '')
  const original = texts.join('')
  if (original === value) { return }
  let prefix = 0
  let suffix = 0
  while (prefix < original.length && prefix < value.length && original[prefix] === value[prefix]) { prefix++ }
  while (suffix < original.length - prefix && suffix < value.length - prefix && original[original.length - suffix - 1] === value[value.length - suffix - 1]) { suffix++ }
  const end = original.length - suffix
  const inserted = value.slice(prefix, value.length - suffix)
  let offset = 0
  let insertedOnce = false
  nodes.forEach((node, index) => {
    const text = texts[index]
    const next = offset + text.length
    const before = text.slice(0, Math.max(0, Math.min(text.length, prefix - offset)))
    const after = text.slice(Math.max(0, Math.min(text.length, end - offset)))
    const acceptsInsertion = !insertedOnce && (prefix < next || index === nodes.length - 1)
    const replacement = before + (acceptsInsertion ? inserted : '') + after
    if (acceptsInsertion) { insertedOnce = true }
    if (replacement !== text) {
      node.textContent = replacement
      node.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve')
    }
    offset = next
  })
}

export function openDocxDocument (bytes: Uint8Array, parser = new DOMParser(), serializer = new XMLSerializer()): DocumentSession {
  const entries = openOfficePackage(bytes)
  const main = entries['word/document.xml']
  if (!main || main.length > 4 * 1024 * 1024) { throw new Error('这不是受支持的 DOCX 文档，或正文体积过大。') }
  const originalXml = strFromU8(main)
  const xml = parseXml(originalXml, parser)
  const ns = xml.documentElement.namespaceURI || ''
  if (!wordNamespaces.includes(ns) || xml.documentElement.localName !== 'document') { throw new Error('文档不是有效的 Word 正文。') }
  const paragraphs = paragraphNodes(xml, ns)
  if (paragraphs.length > 5000) { throw new Error('正文段落过多，请在桌面文档编辑器中打开。') }
  const fields = paragraphs.map((nodes, index) => ({ label: '正文段落 ' + (index + 1), value: nodes.map(node => node.textContent || '').join('') }))
  const initial = fields.map(field => field.value)
  const settings = entries['word/settings.xml']
  const protection = settings ? parseXml(strFromU8(settings), parser).getElementsByTagNameNS(ns, 'documentProtection') : []
  const protectedFile = Array.from(protection).some(node => ['1', 'true', 'on'].includes(node.getAttributeNS(ns, 'enforcement') || ''))
  const signed = Object.keys(entries).some(name => name.startsWith('_xmlsignatures/'))
  const editable = fields.length > 0 && !protectedFile && !signed
  const note = protectedFile || signed ? '文档带有编辑保护或数字签名，此处仅预览正文。' : fields.length === 0 ? '未找到可编辑的正文文字，文档可能主要包含图片。' :
    '正文编辑：修改现有段落文字，保留其他文件资源。此处不预览完整 Word 排版、图表、页眉和页脚；不会写回原文件。'
  const session = createSession(fields, editable, note, () => {
    if (!fields.some((field, index) => field.value !== initial[index])) { return bytes.slice() }
    const result = parseXml(originalXml, parser)
    const nodes = paragraphNodes(result, ns)
    fields.forEach((field, index) => replaceText(nodes[index], field.value))
    return zipSync({ ...entries, 'word/document.xml': strToU8(serializer.serializeToString(result)) }, { level: 3 })
  }, true)
  session.locked = protectedFile || signed
  return session
}

export function openOfficePackage (bytes: Uint8Array): Record<string, Uint8Array> {
  if (bytes.length > 20 * 1024 * 1024) { throw new Error('Office 文件超过 20 MB，请在另一个页面打开。') }
  let total = 0
  let count = 0
  const entries = unzipSync(bytes, { filter (file) {
    total += file.originalSize
    if (total > maxExpandedBytes || ++count > 10000) { throw new Error('文档解压后的体积过大，无法在弹窗中编辑。') }
    return true
  } })
  if (!entries['[Content_Types].xml']) { throw new Error('这不是受支持的 Office 文档。') }
  return entries
}

/** Bound response reads even if the server omits Content-Length. */
export async function readDocumentResponse (response: Response, limit = 20 * 1024 * 1024): Promise<Uint8Array> {
  if (!response.ok) { throw new Error('文件请求失败（HTTP ' + response.status + '）。') }
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel().catch(() => {})
    throw new Error('文件超过弹窗预览的大小限制。')
  }
  if (!response.body) { throw new Error('浏览器未提供可读取的文件内容。') }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) { break }
      size += result.value.length
      if (size > limit) { throw new Error('文件超过弹窗预览的大小限制。') }
      chunks.push(result.value)
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return bytes
}
