import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { DocxDocument } from '../../src/docx_document.ts'
import { createDocxEngine, docxPageGroups } from '../../src/docx_engine.ts'
import { openWordDocument } from '../../src/word_editor.ts'
import { createDocumentStub } from '../helpers/browser_dom.mjs'

const previous = { DOMParser: globalThis.DOMParser, XMLSerializer: globalThis.XMLSerializer }
globalThis.DOMParser = DOMParser
globalThis.XMLSerializer = XMLSerializer
after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) { delete globalThis[key] } else { globalThis[key] = value } } })
const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const opaque = strToU8('opaque original bytes: do not rebuild charts, media, headers or custom XML')
function fixture (body = '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Hello</w:t></w:r><w:r><w:t> world</w:t></w:r></w:p>', extra = {}) {
  return zipSync({
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    'word/document.xml': strToU8(`<w:document xmlns:w="${ns}"><w:body>${body}<w:sectPr><w:pgSz w:w="11910" w:h="16845"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`),
    'word/media/preserved.bin': opaque,
    'word/charts/chart1.xml': opaque,
    'word/header1.xml': opaque,
    'customXml/item1.xml': opaque,
    ...extra
  })
}
function model (bytes = fixture()) { return new DocxDocument(bytes) }

describe('owned DOCX XML and package model', () => {
  it('returns exact original bytes when unchanged, then preserves every unrelated package part after edits', () => {
    const bytes = fixture()
    const file = model(bytes)
    assert.deepEqual(file.exportBytes(), bytes)
    file.setText(file.paragraphs[0], 'Hello brave world')
    const parts = unzipSync(file.exportBytes())
    const original = unzipSync(bytes)
    for (const key of Object.keys(original).filter(key => key !== 'word/document.xml')) { assert.deepEqual(parts[key], original[key], key) }
    const reopened = model(file.exportBytes())
    assert.equal(reopened.text(reopened.paragraphs[0]), 'Hello brave world')
    assert.equal(reopened.style(reopened.paragraphs[0], reopened.child(reopened.paragraphs[0], 'r')).bold, true)
  })

  it('formats only the selected text by splitting runs and retains untouched mixed formatting', () => {
    const file = model()
    const p = file.paragraphs[0]
    file.format(p, 'italic', undefined, 6, 11)
    assert.equal(file.text(p), 'Hello world')
    const runs = file.children(p).filter(node => node.localName === 'r')
    assert.deepEqual(runs.map(run => file.text(run)), ['Hello', ' ', 'world'])
    assert.equal(file.style(p, runs[0]).bold, true)
    assert.equal(file.style(p, runs[0]).italic, undefined)
    assert.equal(file.style(p, runs[2]).italic, true)
    file.format(p, 'italic', undefined, 6, 11)
    assert.equal(file.style(p, file.children(p).at(-1)).italic, false)
    file.format(p, 'color', '#0066ff', 0, 5)
    assert.equal(file.style(p, file.child(p, 'r')).color, '#0066ff')
    assert.match(strFromU8(unzipSync(file.exportBytes())['word/document.xml']), /xml:space="preserve"/)
  })

  it('reads style inheritance/defaults and writes run properties in OOXML schema order', () => {
    const styles = `<w:styles xmlns:w="${ns}"><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="21"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Base"><w:rPr><w:b/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:basedOn w:val="Base"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="36"/></w:rPr></w:style></w:styles>`
    const file = model(fixture('<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Title</w:t></w:r></w:p>', { 'word/styles.xml': strToU8(styles) }))
    const p = file.paragraphs[0]
    assert.equal(file.style(p).bold, true)
    assert.equal(file.style(p).size, 24)
    assert.equal(file.style(p).align, 'center')
    file.format(p, 'size', '18'); file.format(p, 'color', '#ff0000'); file.format(p, 'font', 'Arial'); file.format(p, 'italic')
    const run = file.child(p, 'r')
    assert.equal(file.children(run)[0].localName, 'rPr')
    assert.deepEqual(file.children(file.child(run, 'rPr')).map(node => node.localName), ['rFonts', 'i', 'color', 'sz'])
  })

  it('supports alternate XML prefixes and the strict Word namespace', () => {
    const parts = unzipSync(fixture())
    parts['word/document.xml'] = strToU8(strFromU8(parts['word/document.xml']).replaceAll('w:', 'x:').replaceAll('xmlns:w=', 'xmlns:x=').replace(ns, 'http://purl.oclc.org/ooxml/wordprocessingml/main'))
    const file = model(zipSync(parts))
    file.format(file.paragraphs[0], 'center')
    const reopened = model(file.exportBytes())
    assert.equal(reopened.style(reopened.paragraphs[0]).align, 'center')
    assert.equal(reopened.text(reopened.paragraphs[0]), 'Hello world')
  })

  it('edits blank paragraphs, splits paragraphs without duplicate bookmarks and escapes text safely', () => {
    const file = model(fixture('<w:p><w:bookmarkStart w:id="1" w:name="bookmark"/><w:r><w:t>abcd</w:t></w:r><w:bookmarkEnd w:id="1"/></w:p><w:p/>'))
    const next = file.split(file.paragraphs[0], 2)
    assert.equal(file.text(file.paragraphs[0]), 'ab')
    assert.equal(file.text(next), 'cd')
    assert.equal(next.getElementsByTagNameNS(ns, 'bookmarkStart').length, 0)
    file.setText(file.paragraphs[2], '<script>& 中文 😀')
    const reopened = model(file.exportBytes())
    assert.equal(reopened.text(reopened.paragraphs[2]), '<script>& 中文 😀')
    assert.throws(() => file.setText(file.paragraphs[0], 'bad\u0001'), /控制字符/)
  })

  it('keeps complex paragraphs read-only without blocking simple table-cell edits', () => {
    const complex = '<w:p><w:hyperlink w:anchor="target"><w:r><w:t>Link</w:t></w:r></w:hyperlink><w:r><w:drawing/></w:r></w:p>'
    const file = model(fixture(complex + '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'))
    assert.equal(file.editable(file.paragraphs[0]), false)
    const before = new XMLSerializer().serializeToString(file.paragraphs[0])
    assert.throws(() => file.setText(file.paragraphs[0], 'replace'), /暂不支持/)
    file.setText(file.paragraphs[1], 'Edited cell')
    const reopened = model(file.exportBytes())
    assert.equal(new XMLSerializer().serializeToString(reopened.paragraphs[0]), before)
    assert.equal(reopened.text(reopened.paragraphs[1]), 'Edited cell')
  })

  it('preserves protected/signed files and guards multi-section layout changes', () => {
    const protectedFile = model(fixture(undefined, { 'word/settings.xml': strToU8(`<w:settings xmlns:w="${ns}"><w:documentProtection w:enforcement="1"/></w:settings>`) }))
    assert.equal(protectedFile.locked, true)
    assert.throws(() => protectedFile.format(protectedFile.paragraphs[0], 'bold'), /只读/)
    const signed = model(fixture(undefined, { '_xmlsignatures/sig1.xml': opaque }))
    assert.throws(() => signed.setLayout('landscape'), /只读/)
    const multiple = model(fixture('<w:p><w:pPr><w:sectPr/></w:pPr><w:r><w:t>Section</w:t></w:r></w:p>'))
    assert.throws(() => multiple.setLayout('landscape'), /多节/)
  })

  it('exports paragraph alignment, line spacing, page breaks, paper direction and margins', () => {
    const file = model()
    const p = file.paragraphs[0]
    file.format(p, 'right'); file.format(p, 'spacing', '2'); file.format(p, 'pageBreak')
    file.setLayout('landscape'); file.setLayout('margins', 'narrow')
    const reopened = model(file.exportBytes())
    assert.equal(reopened.style(reopened.paragraphs[0]).align, 'right')
    assert.equal(reopened.style(reopened.paragraphs[0]).spacing, 2)
    assert.equal(reopened.style(reopened.paragraphs[0]).pageBreak, true)
    assert.equal(reopened.layout.paperDirection, 'horizontal')
    assert.ok(reopened.layout.width > reopened.layout.height)
    assert.deepEqual(reopened.layout.margins, [48, 48, 48, 48])
  })
})

describe('native DOCX editing and pagination lifecycle', () => {
  it('uses the native selection offsets for formatting and refuses cross-paragraph edits', async () => {
    const doc = createDocumentStub(); const host = doc.createElement('div')
    const bytes = fixture('<w:p><w:r><w:t>Hello world</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t></w:r></w:p>')
    const engine = await createDocxEngine(host, bytes.buffer, false)
    let paragraphs = host.querySelectorAll('[data-docx-paragraph]')
    const original = engine.value().data
    doc.getSelection = () => ({ rangeCount: 1, getRangeAt: () => ({ startContainer: paragraphs[0].children[0], endContainer: paragraphs[1].children[0] }) })
    assert.throws(() => engine.run('bold'), /一个段落/)
    assert.equal(engine.value().data, original)
    doc.getSelection = () => ({
      rangeCount: 1,
      getRangeAt: () => ({
        startContainer: paragraphs[0].children[0],
        endContainer: paragraphs[0].children[0],
        startOffset: 6,
        toString: () => 'world',
        cloneRange: () => ({ selectNodeContents () {}, setEnd () {}, toString: () => 'Hello ' })
      })
    })
    engine.run('italic')
    const exported = model(engine.exportBytes())
    const p = exported.paragraphs[0]
    assert.equal(exported.styleAt(p, 0).italic, undefined)
    assert.equal(exported.styleAt(p, 6).italic, true)
    paragraphs = host.querySelectorAll('[data-docx-paragraph]')
    engine.destroy()
  })

  it('paginates blocks without losing content, respects explicit breaks, and retains oversized blocks', () => {
    assert.deepEqual(docxPageGroups([{ height: 30 }, { height: 50 }, { height: 30 }, { height: 200 }, { height: 10, breakBefore: true }], 100), [[0, 1], [2], [3], [4]])
  })

  it('runs the default production engine and ribbon with no external editor adapter', async () => {
    const doc = createDocumentStub()
    const body = doc.createElement('div')
    const controller = new AbortController()
    const session = await openWordDocument(fixture(), body, () => {}, controller.signal)
    assert.ok(body.querySelector('[data-docx-page]'))
    assert.equal(body.querySelectorAll('canvas').length, 0)
    const input = body.querySelector('[data-docx-paragraph]')
    assert.equal(input.getAttribute('contenteditable'), 'plaintext-only')
    input.textContent = 'Owned engine edit'; input.emit('input')
    assert.equal(session.dirty(), true)
    const file = model(session.exportBytes())
    assert.equal(file.text(file.paragraphs[0]), 'Owned engine edit')
    controller.abort()
    assert.equal(body.children.length, 0)
    assert.equal(doc.handlers.get('selectionchange').length, 0)
  })

  it('supports undo/redo and read-only mode without exporting changed opaque parts', async () => {
    const doc = createDocumentStub(); const host = doc.createElement('div')
    const engine = await createDocxEngine(host, fixture().buffer, false)
    const original = engine.value().data
    const input = host.querySelector('[data-docx-paragraph]')
    input.textContent = 'Changed'; input.emit('input')
    assert.notEqual(engine.value().data, original)
    engine.run('undo'); assert.equal(engine.value().data, original)
    engine.run('redo')
    const redone = model(engine.exportBytes())
    assert.equal(redone.text(redone.paragraphs[0]), 'Changed')
    engine.run('center')
    const centered = model(engine.exportBytes())
    assert.equal(centered.style(centered.paragraphs[0]).align, 'center')
    const before = engine.value().data
    engine.mode(true); engine.run('bold'); assert.equal(engine.value().data, before)
    assert.equal(host.querySelector('[data-docx-paragraph]').getAttribute('contenteditable'), 'false')
    await engine.exportCopy('own.docx')
    assert.equal(doc.downloads.length, 1)
    engine.destroy(); engine.destroy()
    assert.equal(host.children.length, 0)
  })
})
