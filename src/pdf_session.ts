import { PDFDocument, PDFArray, PDFDict, PDFName, PDFBool, PDFHexString, PDFString, PDFSignature } from 'pdf-lib'
import { createSession } from './document_session.ts'
import type { DocumentSession } from './document_session.ts'

const noteKey = PDFName.of('MarkdownItEditableNote')
const isEditableNote = (dict: PDFDict): boolean => dict.lookup(noteKey) === PDFBool.True

/** Add/edit Unicode sticky-note annotations; never claim to replace PDF text. */
export async function openPdfDocument (bytes: Uint8Array): Promise<DocumentSession> {
  if (bytes.length > 20 * 1024 * 1024) { throw new Error('PDF 文件超过 20 MB，请在另一个页面打开。') }
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false })
  if (pdf.getPageCount() > 300) { throw new Error('PDF 超过 300 页，请使用专用 PDF 编辑器。') }
  const signed = pdf.catalog.has(PDFName.of('Perms')) || pdf.getForm().getFields().some(field => field instanceof PDFSignature && field.acroField.dict.has(PDFName.of('V')))
  const fields = pdf.getPages().map((page, index) => {
    const annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)
    const texts: string[] = []
    if (annotations) {
      for (let i = 0; i < annotations.size(); i++) {
        const dict = annotations.lookup(i)
        if (dict instanceof PDFDict && isEditableNote(dict)) {
          const text = dict.lookup(PDFName.of('Contents'))
          if (text instanceof PDFString || text instanceof PDFHexString) { texts.push(text.decodeText()) }
        }
      }
    }
    return { label: '第 ' + (index + 1) + ' 页批注', group: '第 ' + (index + 1) + ' 页', value: texts.join('\n'), multiline: true, readOnly: signed }
  })
  const initial = fields.map(field => field.value)
  return createSession(fields, !signed && fields.length > 0, signed ? 'PDF 含有签名或认证信息，此处只读预览，避免使签名失效。' :
    'PDF 基础编辑：为各页添加或修改本工具创建的文字批注，支持中文。不会替换原文、重排版或编辑其他批注；下载副本保留原页面。批注在不同阅读器中的显示方式可能不同。', async () => {
    if (!fields.some((field, index) => field.value !== initial[index])) { return bytes.slice() }
    const result = await PDFDocument.load(bytes, { updateMetadata: false })
    result.getPages().forEach((page, index) => {
      if (fields[index].value === initial[index]) { return }
      let annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)
      if (!annotations) { annotations = result.context.obj([]); page.node.set(PDFName.of('Annots'), annotations) }
      for (let i = annotations.size() - 1; i >= 0; i--) {
        const dict = annotations.lookup(i)
        if (dict instanceof PDFDict && isEditableNote(dict)) { annotations.remove(i) }
      }
      if (!fields[index].value.trim()) { return }
      const crop = page.getCropBox()
      const annotation = result.context.obj({
        Type: 'Annot', Subtype: 'Text', Rect: [crop.x + 12, crop.y + crop.height - 36, crop.x + 36, crop.y + crop.height - 12],
        Contents: PDFHexString.fromText(fields[index].value), T: PDFHexString.fromText('Markdown 文档批注'),
        Name: 'Comment', Open: false, C: [1, 0.82, 0.18], F: 4
      })
      annotation.set(noteKey, PDFBool.True)
      annotations.push(result.context.register(annotation))
    })
    return result.save({ updateFieldAppearances: false })
  }, false, value => {
    if (value.length > 20000) { throw new Error('单页批注最多支持 20000 个字符。') }
    if (Array.from(value).some(char => { const point = char.codePointAt(0)!; return point >= 0xD800 && point <= 0xDFFF })) { throw new Error('批注包含无效的 Unicode 字符。') }
  })
}
