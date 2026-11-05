import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { strFromU8, unzipSync } from 'fflate'
import { workbookFixture, slidesFixture, sheetNs } from '../helpers/office_fixtures.mjs'
import { openXlsxDocument, openPptxDocument, cellCoordinate, columnLabel } from '../../src/office_sessions.ts'

const sheet = bytes => openXlsxDocument(bytes, new DOMParser(), new XMLSerializer())
const slides = bytes => openPptxDocument(bytes, new DOMParser(), new XMLSerializer())

describe('editable spreadsheet copies', () => {
  it('reads sheets, shared strings, booleans, raw values, and read-only formulas', () => {
    const bytes = workbookFixture()
    const session = sheet(bytes)
    const cell = label => session.fields.find(field => field.label === label)
    assert.equal(cell('预算 · A1').value, 'Shared')
    assert.equal(cell('预算 · C2').value, 'true')
    assert.equal(cell('预算 · D2').value, '=SUM(A2,A3)')
    assert.equal(cell('预算 · F3').readOnly, true)
    assert.equal(cell('Other · A1').group, 'Other')
    assert.deepEqual(session.exportBytes(), bytes)
    assert.throws(() => session.update(session.fields.indexOf(cell('预算 · D2')), '=1+1'), /不能/)
  })

  it('edits individual cells without changing shared strings or other assets, and requests recalculation on open', () => {
    const original = workbookFixture()
    const session = sheet(original)
    const index = label => session.fields.findIndex(field => field.label === label)
    session.update(index('预算 · A1'), '改过的共享文字')
    session.update(index('预算 · A2'), '25.75')
    session.update(index('预算 · C2'), 'false')
    const bytes = session.exportBytes()
    const result = sheet(bytes)
    assert.equal(result.fields[index('预算 · A1')].value, '改过的共享文字')
    assert.equal(result.fields[index('预算 · B1')].value, 'Shared')
    assert.equal(result.fields[index('预算 · A2')].value, '25.75')
    assert.equal(result.fields[index('预算 · C2')].value, 'false')
    const zip = unzipSync(bytes)
    assert.deepEqual(zip['xl/sharedStrings.xml'], unzipSync(original)['xl/sharedStrings.xml'])
    assert.deepEqual(zip['xl/media/image.png'], new Uint8Array([1, 2, 3]))
    const xml = strFromU8(zip['xl/worksheets/sheet1.xml'])
    assert.ok(xml.includes('s="1"'))
    assert.ok(xml.includes('<f>SUM(A2,A3)</f>'))
    const book = strFromU8(zip['xl/workbook.xml'])
    assert.ok(book.includes('fullCalcOnLoad="1"'))
    assert.ok(book.indexOf('calcPr') < book.indexOf('extLst'))
    session.markDownloaded()
    assert.equal(session.dirty(), false)
  })

  it('treats edited text as literal text, clears values, and rejects XML-invalid characters', () => {
    const session = sheet(workbookFixture())
    const textIndex = session.fields.findIndex(field => field.label === '预算 · B2')
    const numberIndex = session.fields.findIndex(field => field.label === '预算 · A2')
    session.update(textIndex, '=HYPERLINK("https://example.com")')
    session.update(numberIndex, '')
    const zip = unzipSync(session.exportBytes())
    const xml = new DOMParser().parseFromString(strFromU8(zip['xl/worksheets/sheet1.xml']), 'application/xml')
    const cell = Array.from(xml.getElementsByTagNameNS(sheetNs, 'c')).find(node => node.getAttribute('r') === 'B2')
    assert.equal(cell.getAttribute('t'), 'inlineStr')
    assert.equal(cell.getElementsByTagNameNS(sheetNs, 'f').length, 0)
    assert.equal(sheet(session.exportBytes()).fields[numberIndex].value, '')
    assert.throws(() => session.update(textIndex, '\u0000'), /控制字符/)
  })

  it('respects sheet protection and signatures, rejects invalid cell coordinates and external sheet relationships', () => {
    const protectedXml = `<worksheet xmlns="${sheetNs}"><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData><sheetProtection sheet="1"/></worksheet>`
    const session = sheet(workbookFixture({ 'xl/worksheets/sheet1.xml': protectedXml }))
    assert.throws(() => session.update(0, '2'), /不能/)
    const signed = sheet(workbookFixture({ '_xmlsignatures/sig.xml': '<Signature/>' }))
    assert.equal(signed.editable, false)
    assert.throws(() => sheet(workbookFixture({ 'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" TargetMode="External" Target="https://example.com/sheet.xml"/></Relationships>' })), /关系/)
    assert.deepEqual(cellCoordinate('XFD1048576'), { column: 16384, row: 1048576 })
    assert.equal(columnLabel(27), 'AA')
    for (const address of ['A0', 'XFE1', 'A1048577', 'bad']) { assert.throws(() => cellCoordinate(address)) }
  })
})

describe('editable presentation text copies', () => {
  it('uses actual slide relationships/order and preserves untouched media and text formatting', () => {
    const original = slidesFixture()
    const session = slides(original)
    assert.equal(session.fields[0].value, 'First displayed slide')
    assert.equal(session.fields[0].group, '幻灯片 1')
    assert.deepEqual(session.exportBytes(), original)
    session.update(0, '编辑后的第一张幻灯片')
    const bytes = session.exportBytes()
    const reopened = slides(bytes)
    assert.equal(reopened.fields[0].value, '编辑后的第一张幻灯片')
    assert.equal(reopened.fields[1].value, 'Second displayed slide')
    const zip = unzipSync(bytes)
    assert.deepEqual(zip['ppt/media/image.png'], new Uint8Array([4, 5, 6]))
    assert.ok(strFromU8(zip['ppt/slides/slide2.xml']).includes('b="1"'))
    assert.throws(() => session.update(0, 'new\nparagraph'), /段落/)
  })

  it('keeps signed presentations and image-only slides read-only', () => {
    assert.equal(slides(slidesFixture({ '_xmlsignatures/sig.xml': '<Signature/>' })).editable, false)
    const imageSlide = '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree/></p:cSld></p:sld>'
    const session = slides(slidesFixture({ 'ppt/slides/slide2.xml': imageSlide }))
    assert.equal(session.fields[0].readOnly, true)
    assert.ok(session.fields[0].value.includes('没有可编辑文字'))
    assert.throws(() => session.update(0, 'bad'), /不能/)
  })
})
