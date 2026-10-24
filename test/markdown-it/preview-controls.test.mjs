import assert from 'node:assert/strict'
import { after, afterEach, describe, it } from 'node:test'

import { NodeStub, createDocumentStub } from '../helpers/browser_dom.mjs'

const originalDocument = globalThis.document
const originalElement = globalThis.Element
const doc = createDocumentStub()
globalThis.document = doc
globalThis.Element = NodeStub
await import('../../src/preview_controls.ts')

afterEach(() => {
  doc.querySelector('[data-preview-dialog]')?.close()
  for (const node of [...doc.body.childNodes]) { node.remove() }
  doc.statePreserving = false
  doc.preservedMoves = 0
  doc.failOpen = false
  doc.defaultView.innerWidth = 1280
  doc.defaultView.innerHeight = 900
  doc.documentElement.style.removeProperty('overflow')
})
after(() => {
  if (originalDocument === undefined) { delete globalThis.document } else { globalThis.document = originalDocument }
  if (originalElement === undefined) { delete globalThis.Element } else { globalThis.Element = originalElement }
})

function fixture () {
  const wrapper = doc.createElement('div')
  wrapper.setAttribute('data-preview-container', '')
  wrapper.dataset.previewTitle = '<Table>'
  const opener = doc.createElement('button')
  opener.setAttribute('data-preview-open', '')
  const content = doc.createElement('div')
  content.setAttribute('data-preview-content', '')
  const menu = doc.createElement('div')
  const table = doc.createElement('table')
  table.filtered = true
  content.append(menu, table)
  wrapper.append(opener, content)
  doc.body.append(wrapper)
  doc.activeElement = opener
  return { wrapper, opener, content, menu, table }
}

function open (opener) {
  doc.dispatch('click', { target: opener, preventDefault () {} })
  return doc.querySelector('[data-preview-dialog]')
}

describe('expanded preview modal lifecycle', () => {
  it('moves live controls into a modal and restores their position, state, scroll lock, and focus', () => {
    const { wrapper, opener, content, menu, table } = fixture()
    doc.documentElement.style.setProperty('overflow', 'scroll', 'important')
    const modal = open(opener)
    assert.equal(modal.open, true)
    assert.equal(modal.attributes['aria-label'], '<Table> · 放大预览')
    assert.equal(modal.querySelector('strong').textContent, '<Table>')
    assert.equal(modal.querySelector('[data-preview-content]'), content)
    assert.deepEqual(content.children, [menu, table])
    assert.equal(table.filtered, true)
    assert.equal(opener.attributes['aria-expanded'], 'true')
    assert.equal(doc.documentElement.style.getPropertyValue('overflow'), 'hidden')
    modal.close()
    assert.equal(content.parentNode, wrapper)
    assert.deepEqual(wrapper.childNodes, [opener, content])
    assert.equal(table.filtered, true)
    assert.equal(doc.activeElement, opener)
    assert.equal(doc.documentElement.style.getPropertyValue('overflow'), 'scroll')
    assert.equal(doc.documentElement.style.getPropertyPriority('overflow'), 'important')
    assert.equal(opener.attributes['aria-expanded'], 'false')
    assert.equal(doc.querySelector('[data-preview-dialog]'), null)
  })

  it('supports bounded zoom, reset, and maximizing without duplicating the content', () => {
    const { opener, content } = fixture()
    const modal = open(opener)
    const [smaller, reset, larger, maximize, close] = modal.querySelector('[data-preview-tools]').children
    const stage = modal.querySelector('[data-preview-stage]')
    assert.equal(stage.style.width, '912px')
    larger.emit('click')
    assert.equal(stage.style.zoom, '1.25')
    for (let i = 0; i < 20; i++) { larger.emit('click') }
    assert.equal(stage.style.zoom, '3')
    assert.equal(larger.disabled, true)
    for (let i = 0; i < 20; i++) { smaller.emit('click') }
    assert.equal(stage.style.zoom, '0.5')
    assert.equal(smaller.disabled, true)
    reset.emit('click')
    assert.equal(stage.style.zoom, '1')
    assert.equal(reset.textContent, '100%')
    maximize.emit('click')
    assert.equal(modal.dataset.previewMaximized, 'true')
    maximize.emit('click')
    assert.equal(modal.dataset.previewMaximized, 'false')
    assert.equal(stage.children[0], content)
    close.emit('click')
    assert.equal(doc.activeElement, opener)
  })

  it('dismisses on native Escape cancellation or a deliberate backdrop click', () => {
    const { opener } = fixture()
    let modal = open(opener)
    modal.emit('cancel')
    assert.equal(doc.querySelector('[data-preview-dialog]'), null)
    modal = open(opener)
    modal.emit('pointerdown', { clientX: 40, clientY: 40 })
    modal.emit('click', { clientX: 0, clientY: 0 })
    assert.equal(modal.open, true, 'dragging from inside to outside must not dismiss')
    modal.emit('pointerdown', { clientX: 0, clientY: 0 })
    modal.emit('click', { clientX: 0, clientY: 0 })
    assert.equal(doc.querySelector('[data-preview-dialog]'), null)
  })

  it('uses state-preserving movement when available and supports repeated open/close cycles', () => {
    doc.statePreserving = true
    const { opener, wrapper, content } = fixture()
    for (let i = 0; i < 3; i++) {
      open(opener).close()
      assert.equal(content.parentNode, wrapper)
    }
    assert.equal(doc.preservedMoves, 6)
  })

  it('does not open a second modal or lose nodes when opening fails', () => {
    const first = fixture()
    const second = fixture()
    const modal = open(first.opener)
    assert.equal(open(second.opener), modal)
    assert.equal(second.content.parentNode, second.wrapper)
    modal.close()
    doc.failOpen = true
    assert.equal(open(first.opener), null)
    assert.equal(first.content.parentNode, first.wrapper)
    assert.equal(doc.documentElement.style.getPropertyValue('overflow'), '')
  })

  it('drags the title bar, captures the active pointer, and ignores toolbar and secondary-pointer drags', () => {
    const modal = open(fixture().opener)
    const header = modal.querySelector('[data-preview-header]')
    const tool = modal.querySelector('[data-preview-tools]').children[0]
    header.emit('pointerdown', { target: tool, button: 0, pointerId: 1 })
    modal.emit('pointermove', { pointerId: 1, clientX: 300, clientY: 300 })
    assert.equal(modal.style.left, undefined)
    header.emit('pointerdown', { button: 2, pointerId: 1 })
    assert.equal(header.capturedPointer, undefined)
    header.emit('pointerdown', { button: 0, pointerId: 2, isPrimary: false })
    assert.equal(header.capturedPointer, undefined)
    const down = header.emit('pointerdown', { button: 0, pointerType: 'mouse', pointerId: 1, clientX: 100, clientY: 50 })
    assert.equal(down.defaultPrevented, undefined, 'mouse focus/double-click behavior remains native')
    assert.equal(header.capturedPointer, 1)
    modal.emit('pointermove', { pointerId: 2, clientX: 1000, clientY: 1000 })
    assert.equal(modal.style.left, undefined)
    modal.emit('pointermove', { pointerId: 1, clientX: 200, clientY: 100 })
    assert.equal(modal.style.left, '120px')
    assert.equal(modal.style.top, '70px')
    modal.emit('pointerup', { pointerId: 1 })
    assert.equal(header.capturedPointer, null)
    assert.equal(modal.dataset.previewAdjusting, undefined)
    modal.emit('pointermove', { pointerId: 1, clientX: 900, clientY: 900 })
    assert.equal(modal.style.left, '120px')
  })

  it('resizes from corners with a fixed opposite corner and supports pointer cancellation', () => {
    const modal = open(fixture().opener)
    const corner = modal.children.find(node => node.attributes['data-preview-resize'] === 'nw')
    assert.equal(modal.children.filter(node => node.attributes['data-preview-resize']).length, 8)
    corner.emit('pointerdown', { button: 0, pointerId: 3, clientX: 20, clientY: 20 })
    modal.emit('pointermove', { pointerId: 3, clientX: 120, clientY: 100 })
    assert.deepEqual(modal.getBoundingClientRect(), { left: 120, top: 100, width: 860, height: 680, right: 980, bottom: 780 })
    modal.emit('pointercancel', { pointerId: 3 })
    assert.equal(modal.dataset.previewAdjusting, undefined)
    assert.equal(corner.capturedPointer, null)
  })

  it('restores manually adjusted geometry after maximizing and clamps it when the viewport shrinks', () => {
    const modal = open(fixture().opener)
    const header = modal.querySelector('[data-preview-header]')
    header.emit('keydown', { key: 'ArrowRight' })
    header.emit('keydown', { key: 'ArrowDown', shiftKey: true })
    const normal = modal.getBoundingClientRect()
    const maximize = modal.querySelector('[data-preview-tools]').children[3]
    maximize.emit('click')
    assert.equal(modal.style.left, '0px')
    assert.equal(modal.style.width, '1280px')
    assert.equal(modal.style.height, '900px')
    header.emit('keydown', { key: 'ArrowRight' })
    assert.equal(modal.style.left, '0px')
    header.emit('dblclick')
    assert.equal(maximize.attributes['aria-pressed'], 'false')
    assert.deepEqual(modal.getBoundingClientRect(), normal)
    doc.defaultView.innerWidth = 400
    doc.defaultView.innerHeight = 600
    for (const handler of doc.defaultView.handlers.get('resize')) { handler() }
    const rect = modal.getBoundingClientRect()
    assert.ok(rect.left >= 8 && rect.top >= 8 && rect.right <= 392 && rect.bottom <= 592)
  })

  it('releases pointer capture and removes window listeners when closed during a gesture', () => {
    const modal = open(fixture().opener)
    const header = modal.querySelector('[data-preview-header]')
    header.emit('pointerdown', { button: 0, pointerId: 5, clientX: 20, clientY: 20 })
    modal.close()
    assert.equal(header.capturedPointer, null)
    assert.equal(doc.defaultView.handlers.get('resize').length, 0)
    modal.emit('pointermove', { pointerId: 5, clientX: 900, clientY: 900 })
    assert.equal(modal.style.left, undefined)
  })
})
