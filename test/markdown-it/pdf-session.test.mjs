import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PDFDocument, PDFName, PDFArray, PDFDict, PDFString, PDFHexString } from 'pdf-lib'
import { openPdfDocument } from '../../src/pdf_session.ts'

async function fixture (certified = false) {
  const doc = await PDFDocument.create()
  const page = doc.addPage([400, 600])
  page.drawText('Original PDF content')
  const annotation = doc.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [20, 20, 40, 40], Contents: PDFString.of('Existing external comment') })
  page.node.set(PDFName.of('Annots'), doc.context.obj([doc.context.register(annotation)]))
  if (certified) { doc.catalog.set(PDFName.of('Perms'), doc.context.obj({})) }
  return doc.save()
}

describe('local PDF annotation copies', () => {
  it('preserves unchanged PDF bytes and adds Unicode notes without removing existing content or annotations', async () => {
    const bytes = await fixture()
    const session = await openPdfDocument(bytes)
    assert.equal(session.fields[0].value, '')
    assert.deepEqual(await session.exportBytes(), bytes)
    session.update(0, '中文批注 😀\nSecond line')
    assert.equal(session.dirty(), true)
    const result = await session.exportBytes()
    const pdf = await PDFDocument.load(result)
    assert.equal(pdf.getPageCount(), 1)
    assert.equal(pdf.getPage(0).getWidth(), 400)
    const annotations = pdf.getPage(0).node.lookup(PDFName.of('Annots'), PDFArray)
    assert.equal(annotations.size(), 2)
    const comments = []
    for (let i = 0; i < annotations.size(); i++) {
      const dict = annotations.lookup(i, PDFDict)
      comments.push(dict.lookup(PDFName.of('Contents'), PDFString, PDFHexString).decodeText())
    }
    assert.ok(comments.includes('Existing external comment'))
    assert.ok(comments.includes('中文批注 😀\nSecond line'))
    assert.equal((await openPdfDocument(result)).fields[0].value, '中文批注 😀\nSecond line')
    session.markDownloaded()
    assert.equal(session.dirty(), false)
  })

  it('updates/removes this tool’s annotations without accumulating duplicate comments', async () => {
    let session = await openPdfDocument(await fixture())
    session.update(0, 'First note')
    session = await openPdfDocument(await session.exportBytes())
    session.update(0, 'Updated note')
    let bytes = await session.exportBytes()
    let pdf = await PDFDocument.load(bytes)
    assert.equal(pdf.getPage(0).node.lookup(PDFName.of('Annots'), PDFArray).size(), 2)
    session = await openPdfDocument(bytes)
    session.update(0, '')
    bytes = await session.exportBytes()
    pdf = await PDFDocument.load(bytes)
    assert.equal(pdf.getPage(0).node.lookup(PDFName.of('Annots'), PDFArray).size(), 1)
    assert.equal((await openPdfDocument(bytes)).fields[0].value, '')
  })

  it('does not edit certified PDFs and rejects invalid PDF bytes', async () => {
    const session = await openPdfDocument(await fixture(true))
    assert.equal(session.editable, false)
    assert.throws(() => session.update(0, 'bad'), /不能/)
    await assert.rejects(openPdfDocument(new Uint8Array([1, 2, 3])))
  })
})
