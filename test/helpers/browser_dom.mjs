import assert from 'node:assert/strict'

class StyleStub {
  values = new Map()
  priorities = new Map()
  setProperty (name, value, priority = '') { this.values.set(name, value); this.priorities.set(name, priority) }
  getPropertyValue (name) { return this.values.get(name) || '' }
  getPropertyPriority (name) { return this.priorities.get(name) || '' }
  removeProperty (name) { this.values.delete(name); this.priorities.delete(name) }
}

// This adapter tests modal lifecycle and live-node restoration; focus trapping
// and the browser's top layer remain native <dialog> responsibilities.
export class NodeStub {
  constructor (tagName, doc) {
    this.tagName = tagName
    this.ownerDocument = doc
    this.childNodes = []
    this.attributes = {}
    this.dataset = {}
    this.style = new StyleStub()
    this.handlers = new Map()
    this.clientWidth = 960
    this.clientHeight = 700
    if (doc.statePreserving) {
      this.moveBefore = (child, before) => { doc.preservedMoves++; this.insertBefore(child, before) }
    }
  }

  get parentElement () { return this.parentNode || null }
  get isConnected () { return this.tagName === 'html' || Boolean(this.parentNode?.isConnected) }
  get children () { return this.childNodes.filter(node => node.tagName !== '#comment') }
  contains (node) { return node === this || this.children.some(child => child.contains(node)) }
  matches (selector) {
    return selector.split(',').some(part => {
      const match = /^([\w-]+)?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/.exec(part.trim())
      return Boolean(match && (!match[1] || match[1] === this.tagName) &&
        (!match[2] || (Object.hasOwn(this.attributes, match[2]) && (match[3] === undefined || this.attributes[match[2]] === match[3]))))
    })
  }

  closest (selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null }
  querySelector (selector) {
    for (const child of this.children) {
      if (child.matches(selector)) { return child }
      const found = child.querySelector(selector)
      if (found) { return found }
    }
    return null
  }

  querySelectorAll (selector) {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)])
  }

  get textContent () { return (this._text || '') + this.childNodes.map(child => child.textContent).join('') }
  set textContent (value) { this._text = value; for (const child of [...this.childNodes]) { child.remove() } }
  getAttribute (name) { return this.attributes[name] ?? null }

  setAttribute (key, value) {
    this.attributes[key] = value
    if (key.startsWith('data-')) { this.dataset[key.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = value }
  }

  insertBefore (child, before) {
    child.remove()
    const index = before ? this.childNodes.indexOf(before) : this.childNodes.length
    assert.ok(index >= 0)
    this.childNodes.splice(index, 0, child)
    child.parentNode = this
  }

  append (...children) { for (const child of children) { this.insertBefore(child, null) } }
  before (child) { this.parentNode.insertBefore(child, this) }
  remove () {
    if (this.parentNode) { this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this), 1) }
    this.parentNode = null
  }

  addEventListener (name, handler) { this.handlers.set(name, [...(this.handlers.get(name) || []), handler]) }
  removeEventListener (name, handler) { this.handlers.set(name, (this.handlers.get(name) || []).filter(item => item !== handler)) }
  setPointerCapture (id) { this.capturedPointer = id }
  hasPointerCapture (id) { return this.capturedPointer === id }
  releasePointerCapture () { this.capturedPointer = null }
  click () {
    this.emit('click')
    if (this.download && this.href) { this.ownerDocument.downloads.push({ name: this.download, url: this.href }) }
  }

  select () { this.selected = true }
  emit (name, props = {}) {
    const event = { target: this, currentTarget: this, preventDefault () { this.defaultPrevented = true }, ...props }
    for (const handler of this.handlers.get(name) || []) { handler(event) }
    return event
  }

  showModal () { if (this.ownerDocument.failOpen) { throw new Error('Cannot open') } this.open = true }
  close () { this.open = false; this.emit('close') }
  focus () { this.ownerDocument.activeElement = this }
  getBoundingClientRect () {
    const left = parseFloat(this.style.left || '20')
    const top = parseFloat(this.style.top || '20')
    const width = parseFloat(this.style.width || '960')
    const height = parseFloat(this.style.height || '760')
    return { left, top, width, height, right: left + width, bottom: top + height }
  }
}

export function createDocumentStub () {
  const doc = {
    baseURI: 'https://docs.example/guide/page.html',
    downloads: [],
    copied: [],
    handlers: new Map(),
    statePreserving: false,
    preservedMoves: 0,
    addEventListener (name, handler) { this.handlers.set(name, [...(this.handlers.get(name) || []), handler]) },
    removeEventListener (name, handler) { this.handlers.set(name, (this.handlers.get(name) || []).filter(item => item !== handler)) },
    dispatch (name, props) {
      const event = { preventDefault () { this.defaultPrevented = true }, ...props }
      for (const handler of this.handlers.get(name) || []) { handler(event) }
      return event
    },
    createElement (tag) { return new NodeStub(tag, this) },
    createComment () { return new NodeStub('#comment', this) },
    querySelector (selector) { return this.documentElement.querySelector(selector) },
    querySelectorAll (selector) { return this.documentElement.querySelectorAll(selector) },
    defaultView: {
      innerWidth: 1280,
      innerHeight: 900,
      handlers: new Map(),
      navigator: { clipboard: { async writeText (value) { doc.copied.push(value) } } },
      setTimeout (fn) { fn() },
      getComputedStyle: () => ({ paddingLeft: '24px', paddingRight: '24px' }),
      addEventListener (name, handler) { this.handlers.set(name, [...(this.handlers.get(name) || []), handler]) },
      removeEventListener (name, handler) { this.handlers.set(name, (this.handlers.get(name) || []).filter(item => item !== handler)) }
    }
  }
  doc.documentElement = new NodeStub('html', doc)
  doc.body = new NodeStub('body', doc)
  doc.head = new NodeStub('head', doc)
  doc.documentElement.append(doc.head, doc.body)

  return doc
}
