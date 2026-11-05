import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import { DOMParser } from '@xmldom/xmldom'
import { decodeHTML } from 'entities'
import { NodeStub, createDocumentStub } from '../helpers/browser_dom.mjs'

const previous = { document: globalThis.document, Element: globalThis.Element }
const doc = createDocumentStub()
globalThis.document = doc
globalThis.Element = NodeStub
const { default: markdownit } = await import('../../src/index.ts')
const { mathSelectionText } = await import('../../src/math_controls.ts')
after(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) { delete globalThis[key] } else { globalThis[key] = value }
  }
})
const source = html => decodeHTML(html.match(/data-math-source="([^"]*)"/)[1])
function fragment (html) {
  const xml = new DOMParser().parseFromString('<root>' + html + '</root>', 'application/xml')
  const result = xml.createDocumentFragment()
  for (const node of [...xml.documentElement.childNodes]) { result.appendChild(node) }
  return result
}
const math = (syntax, body = 'Rendered glyphs + hidden assistive duplicate', block = false) => '<span data-math-container="" data-math-source="' + syntax.replace(/\n/g, '&#10;') + '"' + (block ? ' data-math-display=""' : '') + '>' + body + '</span>'
function selection (html, inside = false) {
  const parent = doc.createElement('span')
  if (inside) { parent.setAttribute('data-math-container', ''); parent.setAttribute('data-math-source', '$a$') }
  const glyph = doc.createElement('span'); parent.append(glyph)
  const expanded = []
  const range = {
    startContainer: glyph,
    endContainer: glyph,
    setStartBefore (node) { expanded.push(['start', node]) },
    setEndAfter (node) { expanded.push(['end', node]) },
    cloneContents () { return fragment(html) }
  }
  doc.getSelection = () => ({ isCollapsed: false, rangeCount: 1, getRangeAt: () => ({ cloneRange: () => range }) })
  doc.activeElement = doc.body
  return { parent, expanded }
}
function copy (clipboardData = { values: {}, setData (type, value) { this.values[type] = value } }) {
  return { event: doc.dispatch('copy', { clipboardData }), clipboardData }
}

describe('native selection copying of LaTeX', () => {
  it('retains escaped source separately from inline/display typesetting without adding buttons', () => {
    const inline = String.raw`\frac{a&b}{c} < "x"`
    const html = markdownit().render('$' + inline + '$')
    assert.equal(source(html), '$' + inline + '$')
    assert.ok(html.includes('<span class="math-inline">\\('))
    assert.ok(!html.includes('data-math-copy'))
    const multiline = String.raw`\begin{aligned}` + '\n' + String.raw`a &= b \\ c &= d` + '\n' + String.raw`\end{aligned}`
    const display = markdownit().render('$$\n' + multiline + '\n$$')
    assert.equal(source(display), '$$\n' + multiline + '\n$$')
    assert.ok(display.includes('data-preview-title="公式"'))
    assert.ok(display.includes('<div class="math-block">\\['))
    assert.equal(source(markdownit({ expandPreview: false }).render('$$ x $$')), '$$\nx\n$$')
    assert.equal(markdownit({ math: false }).render('$a$'), '<p>$a$</p>\n')
    assert.equal(source(markdownit().render('[$a$](https://example.com)')), '$a$')
  })

  it('replaces typeset glyphs with LaTeX while preserving surrounding text and multiple formulas', () => {
    selection('Before ' + math('$a$', '<svg><text>A</text></svg><span>duplicate A</span>') + ' and <em>between</em> ' + math('$b$') + ' after')
    const { event, clipboardData } = copy()
    assert.equal(event.defaultPrevented, true)
    assert.equal(clipboardData.values['text/plain'], 'Before $a$ and between $b$ after')
  })

  it('expands partial glyph selections to a whole formula without changing the live selection', () => {
    const { parent, expanded } = selection(math('$a$'), true)
    const { event, clipboardData } = copy()
    assert.equal(event.defaultPrevented, true)
    assert.equal(clipboardData.values['text/plain'], '$a$')
    assert.deepEqual(expanded, [['start', parent], ['end', parent]])
  })

  it('preserves display math and paragraph line breaks while omitting preview UI labels', () => {
    const syntax = '$$\n\\frac{1}{2}\n$$'
    const result = mathSelectionText(fragment('<p>Start</p><div data-preview-toolbar="">放大预览</div>' + math(syntax, 'typeset output', true) + '<p>End<br/>Next line</p>'))
    assert.equal(result.formulas, 1)
    assert.equal(result.text, 'Start\n' + syntax + '\nEnd\nNext line')
  })

  it('leaves ordinary text, input selections, collapsed selections and missing clipboard data to the browser', () => {
    selection('ordinary <em>selected text</em>')
    assert.equal(copy().event.defaultPrevented, undefined)
    selection(math('$a$'))
    for (const tag of ['input', 'textarea']) {
      doc.activeElement = doc.createElement(tag)
      assert.equal(copy().event.defaultPrevented, undefined)
    }
    doc.activeElement = doc.createElement('div'); doc.activeElement.isContentEditable = true
    assert.equal(copy().event.defaultPrevented, undefined)
    doc.activeElement = doc.body
    assert.equal(copy(null).event.defaultPrevented, undefined)
    doc.getSelection = () => ({ isCollapsed: true, rangeCount: 1 })
    assert.equal(copy().event.defaultPrevented, undefined)
  })
})
