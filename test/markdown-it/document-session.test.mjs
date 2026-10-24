import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { strToU8, strFromU8, zipSync, unzipSync } from 'fflate'
import { openDocxDocument, openTextDocument, readDocumentResponse } from '../../src/document_session.ts'

const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
function makeDocx (body, extra = {}) {
  return zipSync({
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    'word/document.xml': strToU8(`<w:document xmlns:w="${ns}"><w:body>${body}</w:body></w:document>`),
    'word/media/image.png': new Uint8Array([1, 2, 3]),
    ...extra
  })
}
const open = bytes => openDocxDocument(bytes, new DOMParser(), new XMLSerializer())
const text = xml => Array.from(new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagNameNS(ns, 't')).map(node => node.textContent).join('')

describe('local document edit sessions', () => {
  it('preserves untouched DOCX bytes and retains unmodified runs, assets, and paragraph structure on export', () => {
    const bytes = makeDocx('<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Hello </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>world</w:t></w:r></w:p>')
    const session = open(bytes)
    assert.equal(session.dirty(), false)
    assert.equal(session.fields[0].value, 'Hello world')
    assert.deepEqual(session.exportBytes(), bytes)
    session.update(0, 'Hello friend')
    assert.equal(session.dirty(), true)
    const entries = unzipSync(session.exportBytes())
    const xml = strFromU8(entries['word/document.xml'])
    assert.equal(text(xml), 'Hello friend')
    assert.ok(xml.includes('<w:b/>') && xml.includes('<w:i/>'))
    assert.ok(xml.includes('Hello </w:t>'))
    assert.deepEqual(entries['word/media/image.png'], new Uint8Array([1, 2, 3]))
    session.markDownloaded()
    assert.equal(session.dirty(), false)
    session.update(0, 'Another edit')
    assert.equal(session.dirty(), true)
    assert.equal(text(strFromU8(unzipSync(session.exportBytes())['word/document.xml'])), 'Another edit')
  })

  it('handles insertion, deletion, boundary edits, Unicode, and literal XML-like content without injection', () => {
    for (const value of ['', 'Hello ', 'world', 'Hello brave world', '<script>test</script>', '你好 😀', 'Hello world!', '!Hello world', 'HeXrld']) {
      const session = open(makeDocx('<w:p><w:r><w:t>Hello </w:t></w:r><w:r><w:t>world</w:t></w:r></w:p>'))
      session.update(0, value)
      const xml = strFromU8(unzipSync(session.exportBytes())['word/document.xml'])
      assert.equal(text(xml), value)
      assert.ok(!xml.includes('<script>'))
    }
  })

  it('does not prompt for reverted edits and rejects paragraph/newline insertion', () => {
    const session = open(makeDocx('<w:p><w:r><w:t>Original</w:t></w:r></w:p>'))
    session.update(0, 'Changed')
    session.update(0, 'Original')
    assert.equal(session.dirty(), false)
    assert.throws(() => session.update(0, 'A\nB'), /段落/)
    assert.throws(() => session.update(0, 'Bad\u0000text'), /控制字符/)
    assert.throws(() => session.update(0, 'Bad\uD800text'), /控制字符/)
    assert.throws(() => session.update(99, 'bad'), /不能/)
  })

  it('keeps protected/signed documents read-only and rejects invalid or entity-bearing files', () => {
    for (const extra of [
      { 'word/settings.xml': strToU8(`<w:settings xmlns:w="${ns}"><w:documentProtection w:enforcement="1"/></w:settings>`) },
      { '_xmlsignatures/sig1.xml': strToU8('<Signature/>') }
    ]) {
      const session = open(makeDocx('<w:p><w:r><w:t>Read only</w:t></w:r></w:p>', extra))
      assert.equal(session.editable, false)
      assert.throws(() => session.update(0, 'changed'), /不能/)
    }
    assert.throws(() => open(strToU8('not a ZIP')))
    assert.throws(() => open(makeDocx('<w:p/>', { 'word/document.xml': strToU8('<!DOCTYPE w [<!ENTITY x "test">]><w/>') })), /DTD/)
    assert.equal(open(makeDocx('<w:p/>')).editable, false)
  })

  it('edits UTF-8 text, retains its BOM, and tracks downloaded revisions', () => {
    const session = openTextDocument(strToU8('\uFEFF你好\nworld'))
    assert.equal(session.fields[0].value, '你好\nworld')
    session.update(0, '更新\nworld')
    assert.equal(session.dirty(), true)
    assert.deepEqual(Array.from(session.exportBytes().slice(0, 3)), [0xEF, 0xBB, 0xBF])
    assert.equal(strFromU8(session.exportBytes().slice(3)), '更新\nworld')
    session.markDownloaded()
    assert.equal(session.dirty(), false)
    assert.throws(() => openTextDocument(new Uint8Array([0xFF, 0xFF])))
  })

  it('bounds both advertised and streamed response sizes', async () => {
    assert.equal(strFromU8(await readDocumentResponse(new Response('hello'))), 'hello')
    await assert.rejects(readDocumentResponse(new Response('error', { status: 403 })), /403/)
    await assert.rejects(readDocumentResponse(new Response('abc', { headers: { 'Content-Length': '300' } }), 10), /大小/)
    await assert.rejects(readDocumentResponse(new Response('abcdefghijk'), 10), /大小/)
  })
})
