import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import markdownit from '../../src/index.ts'

describe('expanded content previews', () => {
  const md = markdownit()
  const count = html => (html.match(/data-preview-container/g) || []).length

  it('wraps a table and its adjacent controls as one preview', () => {
    const html = md.render('| A | B |\n| - | - |\n| 1 | 2 |')
    assert.equal(count(html), 1)
    assert.ok(html.includes('data-preview-title="表格"'))
    assert.match(html, /<div data-preview-content><div class="table-controls-menu"/)
    assert.match(html, /<\/div>\n<table class="table-controlled"/)
    assert.ok(html.includes('</table>\n</div></div>'))
  })

  it('supports tables with interactive table controls disabled', () => {
    const html = markdownit({ tableControls: false }).render('| A |\n| - |\n| 1 |')
    assert.equal(count(html), 1)
    assert.ok(html.includes('<div data-preview-content><table>'))
    assert.ok(!html.includes('data-table-controls-menu'))
  })

  it('supports code, block math, images, iframe embeds, and neural/3D models', () => {
    for (const input of ['```js\nx\n```', '    x', '$$\nx^2\n$$', '![Photo](image.png)', '![Model](model.pt)', '![Scene](scene.glb)', '<img src="https://example.com/image.png">', '<iframe src="https://example.com/embed"></iframe>']) {
      const html = md.render(input)
      assert.equal(count(html), 1, input)
      assert.ok(html.includes('data-preview-open aria-haspopup="dialog"'), input)
    }
    const inline = md.render('Before ![Photo](image.png) after')
    assert.ok(inline.startsWith('<p>Before <span data-preview-container'))
    assert.ok(!inline.includes('<div'))
    assert.ok(!md.render('![Model](model.onnx)').includes('<iframe'))
  })

  it('keeps nested task lists and their menus inside correctly paired wrappers', () => {
    const html = md.render('- [ ] Parent\n  - [x] Child')
    assert.equal(count(html), 2)
    assert.match(html, /data-preview-content><div class="task-list-menu"/)
    assert.match(html, /<\/div>\n<ul class="contains-task-list/)
    assert.ok(!md.render('- Plain list').includes('data-preview-container'))
  })

  it('leaves linked images and invalid iframe markup unwrapped', () => {
    const linked = md.render('[![Photo](image.png)](/details)')
    assert.equal(linked, '<p><a href="/details"><img src="image.png" alt="Photo"></a></p>\n')
    assert.ok(!md.render('[<img src="https://example.com/image.png">](/details)').includes('data-preview-container'))
    assert.ok(!md.render('Video: <iframe src="javascript:alert(1)"></iframe>').includes('data-preview-container'))
    assert.ok(!md.render('<img src="javascript:alert(1)">').includes('data-preview-container'))
  })

  it('keeps strict presets unchanged and can disable enlargement independently', () => {
    const input = '![Photo](image.png)'
    assert.equal(markdownit({ expandPreview: false }).render(input), '<p><img src="image.png" alt="Photo"></p>\n')
    assert.equal(markdownit('commonmark').render(input), '<p><img src="image.png" alt="Photo" /></p>\n')
    assert.ok(!markdownit('zero').enable('image').render(input).includes('data-preview-open'))
    assert.ok(markdownit('commonmark', { expandPreview: true }).render(input).includes('data-preview-open'))
    assert.ok(markdownit({ expandPreview: false }).render('![Model](model.onnx)').includes('data-neural-model'))
  })

  it('escapes preview titles and does not mutate parsed tokens during rendering', () => {
    const tokens = md.parse('| A |\n| - |\n| 1 |', {})
    const original = JSON.stringify(tokens)
    md.renderer.render(tokens, md.options, {})
    assert.equal(JSON.stringify(tokens), original)
    const html = md.render('![<script>alert(1)</script>](image.png)')
    assert.ok(!html.includes('<script>'))
    assert.ok(html.includes('data-preview-title="&lt;script&gt;'))
  })
})
