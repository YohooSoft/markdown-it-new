import assert from 'node:assert/strict'
import { after, afterEach, describe, it } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { zipSync, strToU8 } from 'fflate'
import { PDFDocument } from 'pdf-lib'
import { workbookFixture, slidesFixture } from '../helpers/office_fixtures.mjs'
import { wordEngineStub } from '../helpers/word_engine.mjs'
import { NodeStub, createDocumentStub } from '../helpers/browser_dom.mjs'

const originals = { document: globalThis.document, Element: globalThis.Element, DOMParser: globalThis.DOMParser, XMLSerializer: globalThis.XMLSerializer, fetch: globalThis.fetch }
const doc = createDocumentStub()
const requests = []
globalThis.document = doc
globalThis.Element = NodeStub
globalThis.DOMParser = DOMParser
globalThis.XMLSerializer = XMLSerializer
const fetchText = async (url, options) => { requests.push({ url, options }); return new Response('Original') }
globalThis.fetch = fetchText
const { openDocument } = await import('../../src/document_controls.ts')

afterEach(async () => {
  doc.querySelector('[data-document-unsaved]')?.close()
  await setImmediate()
  doc.querySelector('[data-preview-dialog]')?.close()
  for (const child of [...doc.body.childNodes]) { child.remove() }
  doc.downloads.length = 0
  doc.copied.length = 0
  requests.length = 0
  globalThis.fetch = fetchText
  doc.failOpen = false
  doc.defaultView.navigator.clipboard = { async writeText (value) { doc.copied.push(value) } }
})
after(() => {
  for (const [key, value] of Object.entries(originals)) {
    if (value === undefined) { delete globalThis[key] } else { globalThis[key] = value }
  }
})

function open (file = './note.txt?token=a', word) {
  const link = doc.createElement('a')
  link.setAttribute('href', file)
  link.setAttribute('data-document-link', file.split('.').pop().split('?')[0])
  link.textContent = 'Document title'
  doc.body.append(link)
  const event = word ? { defaultPrevented: openDocument(link, { word }) } : doc.dispatch('click', { target: link, button: 0 })
  return { link, event, modal: doc.querySelector('[data-preview-dialog]') }
}
function button (root, label) { return root.querySelectorAll('button').find(button => button.textContent === label) }
function close (modal) { modal.querySelector('[data-preview-tools]').children.at(-1).click() }
function change (modal, value, label = '编辑正文') {
  button(modal, label).click()
  const input = modal.querySelector('[data-document-input]')
  input.value = value
  input.emit('input')
}

describe('document modal editing and unsaved-copy prompts', () => {
  it('opens XLSX/XLXS links as editable cell grids and prompts before downloading a workbook copy', async () => {
    globalThis.fetch = async () => new Response(workbookFixture())
    const { modal } = open('./book.xlxs')
    await setImmediate()
    assert.equal(modal.querySelectorAll('table').length, 2)
    assert.equal(button(modal, '编辑单元格').disabled, false)
    const cells = modal.querySelectorAll('[data-document-input]')
    assert.equal(cells.find(input => input.getAttribute('aria-label') === '预算 · D2').readOnly, true)
    change(modal, 'Changed cell', '编辑单元格')
    close(modal)
    button(doc.querySelector('[data-document-unsaved]'), '下载副本并关闭').click()
    await setImmediate()
    assert.equal(doc.downloads[0].name, 'book-副本.xlsx')
    assert.equal(doc.querySelector('[data-preview-dialog]'), null)
  })

  it('groups presentation text by actual slide order and exports an edited PPTX copy', async () => {
    globalThis.fetch = async () => new Response(slidesFixture())
    const { modal } = open('./deck.pptx')
    await setImmediate()
    assert.equal(modal.querySelector('[data-document-text]').textContent, 'First displayed slide')
    change(modal, 'Changed slide', '编辑文字')
    button(modal, '下载副本').click()
    await setImmediate()
    assert.equal(doc.downloads[0].name, 'deck-副本.pptx')
    close(modal)
    await setImmediate()
    assert.equal(doc.querySelector('[data-document-unsaved]'), null)
  })

  it('edits PDF annotations, refreshes a local preview without marking it saved, and guards closing', async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage([400, 600])
    const bytes = await pdf.save()
    globalThis.fetch = async () => new Response(bytes)
    const { modal } = open('./report.pdf')
    for (let i = 0; i < 50 && button(modal, '编辑批注').disabled; i++) { await setImmediate() }
    assert.equal(button(modal, '编辑批注').disabled, false)
    change(modal, '需要确认的中文批注', '编辑批注')
    button(modal, '更新 PDF 预览').click()
    for (let i = 0; i < 50 && button(modal, '更新 PDF 预览').disabled; i++) { await setImmediate() }
    assert.ok(modal.querySelector('[data-document-pdf-preview]').src.startsWith('blob:'))
    assert.ok(modal.querySelector('[data-document-dirty]').textContent.includes('未下载'))
    close(modal)
    for (let i = 0; i < 50 && !doc.querySelector('[data-document-unsaved]'); i++) { await setImmediate() }
    button(doc.querySelector('[data-document-unsaved]'), '下载副本并关闭').click()
    for (let i = 0; i < 50 && doc.querySelector('[data-preview-dialog]'); i++) { await setImmediate() }
    assert.equal(doc.downloads[0].name, 'report-副本.pdf')
    assert.equal(doc.querySelector('[data-preview-dialog]'), null)
  })

  it('opens on ordinary link clicks, copies the resolved original URL, and exposes a safe new-page link', async () => {
    const { modal, event, link } = open()
    await setImmediate()
    assert.equal(event.defaultPrevented, true)
    assert.equal(link.getAttribute('href'), './note.txt?token=a')
    assert.equal(requests[0].url, 'https://docs.example/guide/note.txt?token=a')
    assert.ok(requests.every(request => (request.options.method || 'GET') === 'GET'))
    button(modal, '复制链接').click()
    await setImmediate()
    assert.deepEqual(doc.copied, ['https://docs.example/guide/note.txt?token=a'])
    const external = modal.querySelector('[data-preview-tools]').querySelector('a')
    assert.equal(external.target, '_blank')
    assert.equal(external.rel, 'noopener noreferrer')
    assert.equal(external.href, doc.copied[0])
    assert.equal(button(modal, '编辑正文').disabled, false)
    close(modal)
    await setImmediate()
    assert.equal(doc.querySelector('[data-document-unsaved]'), null)
    assert.equal(doc.querySelector('[data-preview-dialog]'), null)
  })

  it('offers continue, discard, and download when closing edited content, without duplicate prompts', async () => {
    const { modal, link } = open()
    await setImmediate()
    change(modal, 'Changed')
    assert.ok(modal.querySelector('[data-document-dirty]').textContent.includes('未下载'))
    close(modal); close(modal)
    assert.equal(doc.querySelectorAll('[data-document-unsaved]').length, 1)
    button(doc.querySelector('[data-document-unsaved]'), '继续编辑').click()
    await setImmediate()
    assert.equal(modal.open, true)
    close(modal)
    button(doc.querySelector('[data-document-unsaved]'), '下载副本并关闭').click()
    await setImmediate()
    assert.equal(doc.downloads.length, 1)
    assert.equal(doc.downloads[0].name, 'note-副本.txt')
    assert.equal(doc.querySelector('[data-preview-dialog]'), null)
    assert.equal(link.getAttribute('aria-expanded'), 'false')
    assert.equal(doc.defaultView.handlers.get('beforeunload').length, 0)
  })

  it('loads DOCX in a paginated editor and downloads one managed DOCX copy after modification', async () => {
    const bytes = zipSync({
      '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
      'word/document.xml': strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Original Word paragraph</w:t></w:r></w:p></w:body></w:document>')
    })
    globalThis.fetch = async () => new Response(bytes)
    let engine
    const { modal } = open('./brief.docx', async host => { engine = wordEngineStub(host); return engine })
    await setImmediate()
    assert.ok(modal.querySelector('[data-word-pages]').querySelector('canvas'))
    assert.equal(button(modal, '只读预览').disabled, false)
    engine.edit('Edited Word paragraph')
    close(modal)
    button(doc.querySelector('[data-document-unsaved]'), '下载副本并关闭').click()
    await setImmediate()
    assert.equal(doc.downloads[0].name, 'brief-副本.docx')
    assert.equal(doc.downloads.length, 1)
    assert.equal(engine.destroyed, true)
    assert.equal(doc.querySelector('[data-preview-dialog]'), null)
  })

  it('guards Escape/backdrop dismissal and allows explicit discard without downloading', async () => {
    const { modal } = open()
    await setImmediate()
    change(modal, 'Changed')
    const unload = { preventDefault () { this.prevented = true } }
    for (const handler of doc.defaultView.handlers.get('beforeunload')) { handler(unload) }
    assert.equal(unload.prevented, true)
    modal.emit('cancel')
    doc.querySelector('[data-document-unsaved]').emit('cancel')
    await setImmediate()
    assert.equal(modal.open, true)
    modal.emit('pointerdown', { clientX: 0, clientY: 0 })
    modal.emit('click', { clientX: 0, clientY: 0 })
    button(doc.querySelector('[data-document-unsaved]'), '不下载，关闭').click()
    await setImmediate()
    assert.equal(doc.querySelector('[data-preview-dialog]'), null)
    assert.equal(doc.downloads.length, 0)
  })

  it('does not prompt after downloading a copy or reverting edits', async () => {
    let { modal } = open()
    await setImmediate()
    change(modal, 'Changed')
    button(modal, '下载副本').click()
    close(modal)
    await setImmediate()
    assert.equal(doc.querySelector('[data-document-unsaved]'), null)
    assert.equal(doc.querySelector('[data-preview-dialog]'), null)
    ;({ modal } = open())
    await setImmediate()
    change(modal, 'Original')
    close(modal)
    await setImmediate()
    assert.equal(doc.querySelector('[data-document-unsaved]'), null)
  })

  it('retains edits if generating the requested download fails', async () => {
    const { modal } = open()
    await setImmediate()
    change(modal, 'Changed')
    const create = URL.createObjectURL
    try {
      URL.createObjectURL = () => { throw new Error('Download unavailable') }
      close(modal)
      button(doc.querySelector('[data-document-unsaved]'), '下载副本并关闭').click()
      await setImmediate()
      assert.equal(modal.open, true)
      assert.ok(modal.querySelector('[data-document-status]').textContent.includes('副本生成失败'))
      assert.equal(modal.querySelector('[data-document-input]').value, 'Changed')
    } finally { URL.createObjectURL = create }
  })

  it('aborts a pending request on close and never inserts late results', async () => {
    let resolveResponse
    let signal
    globalThis.fetch = (url, options) => { signal = options.signal; return new Promise(resolve => { resolveResponse = resolve }) }
    const { modal } = open()
    close(modal)
    await setImmediate()
    assert.equal(signal.aborted, true)
    resolveResponse(new Response('Late result'))
    await setImmediate()
    assert.equal(doc.querySelector('[data-preview-dialog]'), null)
    assert.equal(doc.querySelector('[data-document-pane]'), null)
  })

  it('keeps legacy Office previews read-only and does not send URLs to Office until explicitly requested', () => {
    const office = open('https://files.example/slides.ppt').modal
    assert.equal(office.querySelector('iframe'), null)
    assert.equal(requests.length, 0)
    button(office, '使用 Office 在线预览（公开文件）').click()
    assert.ok(office.querySelector('iframe').src.startsWith('https://view.officeapps.live.com/'))
  })

  it('offers manual copying on clipboard failure and leaves edits unavailable after a failed load', async () => {
    globalThis.fetch = async () => new Response('denied', { status: 403 })
    const { modal } = open()
    await setImmediate()
    assert.equal(button(modal, '编辑正文').disabled, true)
    assert.ok(modal.querySelector('[data-document-status]').textContent.includes('403'))
    doc.defaultView.navigator.clipboard = undefined
    button(modal, '复制链接').click()
    await setImmediate()
    const fallback = modal.querySelector('[data-document-status]').querySelector('input')
    assert.equal(fallback.selected, true)
    assert.ok(fallback.value.endsWith('/note.txt?token=a'))
  })

  it('preserves modified-click navigation and normal links if the modal cannot open', () => {
    doc.failOpen = true
    assert.equal(open().event.defaultPrevented, undefined)
    const link = doc.createElement('a')
    link.setAttribute('href', './note.txt')
    link.setAttribute('data-document-link', 'txt')
    assert.equal(doc.dispatch('click', { target: link, button: 0, ctrlKey: true }).defaultPrevented, undefined)
  })
})
