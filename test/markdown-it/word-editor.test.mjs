import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { zipSync, strToU8 } from 'fflate'
import { createDocumentStub } from '../helpers/browser_dom.mjs'
import { wordEngineStub } from '../helpers/word_engine.mjs'
import { openWordDocument, wordSnapshot } from '../../src/word_editor.ts'

const previous = { DOMParser: globalThis.DOMParser, XMLSerializer: globalThis.XMLSerializer }
globalThis.DOMParser = DOMParser
globalThis.XMLSerializer = XMLSerializer
after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) { delete globalThis[key] } else { globalThis[key] = value } } })
const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
function fixture (extra = {}) {
  return zipSync({
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    'word/document.xml': strToU8(`<w:document xmlns:w="${ns}"><w:body><w:p><w:r><w:t>Original Word paragraph</w:t></w:r></w:p></w:body></w:document>`),
    ...extra
  })
}
function button (root, name) { return root.querySelectorAll('button').find(node => node.getAttribute('aria-label') === name) }

describe('paginated Word document editor integration', () => {
  it('renders a real editor host/ribbon and connects formatting, dirty detection, and managed downloads', async () => {
    const doc = createDocumentStub()
    const body = doc.createElement('div')
    let engine
    let changes = 0
    const session = await openWordDocument(fixture(), body, () => changes++, new AbortController().signal, async host => { engine = wordEngineStub(host); return engine })
    assert.ok(body.querySelector('[data-word-pages]').querySelector('canvas'))
    assert.equal(session.fields.length, 0, 'DOCX must not fall back to paragraph inputs')
    assert.equal(session.dirty(), false)
    button(body, '加粗').click()
    assert.equal(session.dirty(), true)
    assert.equal(button(body, '加粗').getAttribute('aria-pressed'), 'true')
    assert.ok(changes >= 1)
    await session.downloadCopy('brief-副本.docx')
    assert.deepEqual(engine.exports, ['brief-副本.docx'])
    session.markDownloaded()
    assert.equal(session.dirty(), false)
    session.setEditing(false)
    assert.equal(button(body, '加粗').disabled, true)
    session.setEditing(true)
    session.setBusy(true)
    assert.equal(button(body, '加粗').disabled, true)
    session.setBusy(false)
    assert.equal(button(body, '加粗').disabled, false)
    session.dispose()
    assert.equal(engine.destroyed, true)
  })

  it('preserves original file bytes until edited and ignores view-only mode/zoom changes in dirty detection', async () => {
    const doc = createDocumentStub()
    const bytes = fixture()
    let engine
    const session = await openWordDocument(bytes, doc.createElement('div'), () => {}, new AbortController().signal, async host => { engine = wordEngineStub(host); return engine })
    assert.deepEqual(session.exportBytes(), bytes)
    engine.state.options.scale = 2
    session.setEditing(false)
    assert.equal(session.dirty(), false)
    await session.downloadCopy('original-副本.docx')
    assert.equal(engine.exports.length, 0)
    assert.equal(doc.downloads[0].name, 'original-副本.docx')
    session.setEditing(true)
    engine.edit('New paragraph')
    assert.equal(session.dirty(), true)
    engine.edit('Original Word paragraph')
    assert.equal(session.dirty(), false)
    const before = wordSnapshot(engine.value())
    engine.state.options.margins = [48, 48, 48, 48]
    assert.notEqual(wordSnapshot(engine.value()), before)
    session.dispose()
  })

  it('keeps protected documents read-only and destroys an editor when its modal is closed', async () => {
    const doc = createDocumentStub()
    const signal = new AbortController()
    let engine
    const bytes = fixture({ 'word/settings.xml': strToU8(`<w:settings xmlns:w="${ns}"><w:documentProtection w:enforcement="1"/></w:settings>`) })
    const session = await openWordDocument(bytes, doc.createElement('div'), () => {}, signal.signal, async (host, data, locked) => {
      assert.equal(locked, true)
      engine = wordEngineStub(host)
      return engine
    })
    assert.equal(session.editable, false)
    session.setEditing(true)
    assert.equal(engine.state.options.mode, 'readonly')
    signal.abort()
    assert.equal(engine.destroyed, true)
  })

  it('destroys a late-loading editor instead of inserting it after close', async () => {
    const doc = createDocumentStub()
    const body = doc.createElement('div')
    const signal = new AbortController()
    let resolveEngine
    let engine
    const loading = openWordDocument(fixture(), body, () => {}, signal.signal, host => {
      engine = wordEngineStub(host)
      return new Promise(resolve => { resolveEngine = resolve })
    })
    signal.abort()
    resolveEngine(engine)
    await assert.rejects(loading, /取消/)
    assert.equal(engine.destroyed, true)
    assert.equal(body.querySelector('[data-word-editor]'), null)
  })
})
