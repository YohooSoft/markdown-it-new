import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'

// A minimal DOM adapter exercises the delegated browser event handler without
// making external requests or depending on a specific browser installation.
class ElementStub {
  constructor (tagName, attributes = {}) {
    this.tagName = tagName
    this.attributes = attributes
    this.dataset = {}
    this.children = []
    this.hidden = false
    this.style = {}
  }

  matches (selector) {
    return selector.split(',').some(part => {
      const key = part.trim()
      return key.startsWith('[') ? Object.hasOwn(this.attributes, key.slice(1, -1)) : key === this.tagName
    })
  }

  closest (selector) {
    return this.matches(selector) ? this : this.parent?.closest(selector) ?? null
  }

  querySelector (selector) {
    for (const child of this.children) {
      if (child.matches(selector)) { return child }
      const nested = child.querySelector(selector)
      if (nested) { return nested }
    }
    return null
  }

  setAttribute (key, value) { this.attributes[key] = value }
  append (child) { child.parent = this; this.children.push(child) }
}

const originalElement = globalThis.Element
const originalDocument = globalThis.document
const handlers = new Map()
const doc = {
  baseURI: 'https://docs.example/guide/page.html',
  addEventListener: (name, handler) => handlers.set(name, handler),
  createElement: tag => new ElementStub(tag)
}
globalThis.Element = ElementStub
globalThis.document = doc
await import('../../src/neural_model_controls.ts')
after(() => {
  if (originalElement === undefined) { delete globalThis.Element } else { globalThis.Element = originalElement }
  if (originalDocument === undefined) { delete globalThis.document } else { globalThis.document = originalDocument }
})

function fixture () {
  const card = new ElementStub('span', { 'data-neural-model': '' })
  card.ownerDocument = doc
  card.dataset = { neuralModelSource: '../models/test.onnx?v=2', neuralModelViewer: 'https://netron.app/', neuralModelTitle: 'Test network' }
  const toggle = new ElementStub('button', { 'data-neural-model-toggle': '', 'aria-expanded': 'false' })
  const open = new ElementStub('a', { 'data-neural-model-open': '' })
  const slot = new ElementStub('span', { 'data-neural-model-slot': '' })
  const status = new ElementStub('span', { 'data-neural-model-status': '' })
  slot.hidden = true
  for (const child of [toggle, open, slot, status]) { card.append(child) }
  return { card, toggle, open, slot, status }
}

describe('neural-network model browser controls', () => {
  it('loads a sandboxed viewer only on click and reuses it after collapsing', () => {
    const { toggle, slot } = fixture()
    assert.equal(slot.children.length, 0)
    handlers.get('click')({ target: toggle })
    const frame = slot.children[0]
    assert.equal(slot.hidden, false)
    assert.equal(toggle.attributes['aria-expanded'], 'true')
    assert.equal(new URL(frame.src).searchParams.get('url'), 'https://docs.example/models/test.onnx?v=2')
    assert.equal(frame.title, 'Test network')
    assert.equal(frame.referrerPolicy, 'no-referrer')
    assert.equal(frame.attributes.sandbox, 'allow-scripts allow-same-origin allow-downloads')
    handlers.get('click')({ target: toggle })
    assert.equal(slot.hidden, true)
    assert.equal(toggle.attributes['aria-expanded'], 'false')
    handlers.get('click')({ target: toggle })
    assert.equal(slot.hidden, false)
    assert.equal(slot.children.length, 1)
  })

  it('resolves relative model URLs for opening Netron in a new tab', () => {
    const { open, slot } = fixture()
    handlers.get('click')({ target: open })
    assert.equal(new URL(open.attributes.href).searchParams.get('url'), 'https://docs.example/models/test.onnx?v=2')
    assert.equal(slot.children.length, 0)
  })

  it('does not navigate or create an iframe for invalid source or viewer URLs', () => {
    for (const [key, value] of [['neuralModelSource', 'javascript:alert(1)'], ['neuralModelSource', 'file:///model.pt'], ['neuralModelViewer', 'http://untrusted.example/']]) {
      const { card, toggle, slot, status } = fixture()
      card.dataset[key] = value
      let prevented = false
      handlers.get('click')({ target: toggle, preventDefault: () => { prevented = true } })
      assert.equal(prevented, true)
      assert.equal(slot.children.length, 0)
      assert.ok(status.textContent.includes('HTTP(S)'))
    }
  })
})
