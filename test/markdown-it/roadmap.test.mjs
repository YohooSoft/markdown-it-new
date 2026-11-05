import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import markdownit from '../../src/index.ts'

const card = {
  title: 'My Life Roadmap',
  note: '仅为展示形式的示例，并非对你的实际未来作出的预测。',
  items: [
    { period: '2023–2027', title: 'Undergraduate Studies', description: 'Build foundations in artificial intelligence and computer science.' },
    { period: '2027–2030', title: 'Graduate Studies', description: 'Pursue advanced research and academic development.' },
    { period: '2030–2035', title: 'Career Development', description: 'Establish a career, settle in a preferred city, and develop independent projects.' },
    { period: '2035+', title: 'Long-Term Vision', description: 'Pursue financial independence, personal freedom, and lifelong ambitions.' }
  ]
}
const fence = value => '```roadmap\n' + JSON.stringify(value, null, 2) + '\n```\n'
const count = (html, marker) => (html.match(new RegExp(marker, 'g')) || []).length

describe('roadmap cards', () => {
  const md = markdownit({ expandPreview: false })

  it('renders the reference card with ordered stages and connectors', () => {
    const html = md.render(fence(card))
    assert.match(html, /^<section class="roadmap" data-roadmap aria-label="My Life Roadmap"/)
    assert.equal(count(html, 'data-roadmap-step '), 4)
    assert.equal(count(html, 'data-roadmap-connector '), 3)
    assert.equal(count(html, 'data-roadmap-number '), 4)
    assert.match(html, /<ol data-roadmap-items role="list"/)
    for (const item of card.items) {
      assert.ok(html.includes(item.period + ' • ' + item.title))
      assert.ok(html.includes(item.description))
    }
    assert.ok(!html.includes('data-roadmap-badge'))
    assert.ok(html.includes(card.note))
    assert.ok(!html.includes('<pre'))
    assert.ok(!html.includes('data-code-block'))
    assert.ok(!html.includes('<script'))
  })

  it('supports minimal cards without optional content or a trailing connector', () => {
    const html = md.render(fence({ title: '计划', items: [{ title: '开始' }] }))
    assert.ok(html.includes('>计划</h3>'))
    assert.ok(html.includes('>开始</h4>'))
    for (const marker of ['data-roadmap-badge', 'data-roadmap-note', 'data-roadmap-description', 'data-roadmap-connector', ' • ']) {
      assert.ok(!html.includes(marker), marker)
    }
  })

  it('escapes every text field even when arbitrary HTML is enabled', () => {
    const text = '"><script>alert(1)</script><img src=x onerror=alert(1)>&'
    const html = markdownit({ html: true, expandPreview: false }).render(fence({
      title: text,
      badge: text,
      note: text,
      items: [{ period: text, title: text, description: text }]
    }))
    assert.equal(count(html, '&lt;script&gt;'), 7)
    assert.ok(!html.includes('<script'))
    assert.ok(!html.includes('<img'))
    assert.ok(html.includes('aria-label="&quot;&gt;&lt;script&gt;'))
  })

  it('preserves multiline descriptions and treats Markdown as plain text', () => {
    const html = md.render(fence({ title: '**Plan**', items: [{ title: '[Start](javascript:alert(1))', description: 'First line\nSecond line' }] }))
    assert.ok(html.includes('**Plan**'))
    assert.ok(html.includes('[Start](javascript:alert(1))'))
    assert.ok(html.includes('First line\nSecond line'))
    assert.ok(!html.includes('<a '))
    assert.ok(!html.includes('<strong'))
  })

  it('keeps malformed and incomplete data in escaped ordinary code blocks', () => {
    const plain = markdownit({ expandPreview: false, codeControls: false })
    const disabled = markdownit({ roadmaps: false, expandPreview: false, codeControls: false })
    const invalid = [
      'not JSON', 'null', '[]', '{}',
      '{"title":"Plan","items":[',
      ...[
        { title: 123, items: [{ title: 'Step' }] },
        { title: ' ', items: [{ title: 'Step' }] },
        { title: 'Plan', items: [] },
        { title: 'Plan', items: {} },
        { title: 'Plan', items: [null] },
        { title: 'Plan', items: [{ title: '' }] },
        { title: 'Plan', items: [{ title: 'Step' }, { title: false }] },
        { title: 'Plan', badge: {}, items: [{ title: 'Step' }] },
        { title: 'Plan', note: null, items: [{ title: 'Step' }] },
        { title: 'Plan', items: [{ title: 'Step', period: 2027 }] },
        { title: 'Plan', items: [{ title: 'Step', description: ['text'] }] }
      ].map(JSON.stringify)
    ]
    for (const content of invalid) {
      const source = '```roadmap\n' + content + '\n```'
      assert.equal(plain.render(source), disabled.render(source), content)
    }
    const malicious = '```roadmap\n<script>alert(1)</script>\n```'
    assert.ok(plain.render(malicious).includes('&lt;script&gt;'))
  })

  it('can be disabled by option or rule and remains opt-in for strict presets', () => {
    const source = fence(card)
    assert.ok(!markdownit({ roadmaps: false }).render(source).includes('data-roadmap'))
    assert.ok(!markdownit().disable('roadmap').render(source).includes('data-roadmap'))
    for (const preset of ['commonmark', 'zero']) {
      const parser = markdownit(preset).enable('fence')
      assert.ok(!parser.render(source).includes('data-roadmap'))
      parser.set({ roadmaps: true })
      assert.ok(parser.render(source).includes('data-roadmap'))
    }
  })

  it('uses the roadmap preview instead of code controls and highlighting', () => {
    const html = markdownit({ highlight () { throw new Error('Must not highlight roadmap data') } }).render(fence(card))
    assert.equal(count(html, 'data-preview-container'), 1)
    assert.ok(html.includes('data-preview-title="路线图"'))
    assert.ok(html.includes('data-preview-content><section class="roadmap"'))
    assert.ok(!html.includes('data-code-block'))
    assert.ok(!md.render(fence(card)).includes('data-preview-container'))
  })

  it('supports tilde fences, surrounding whitespace, blockquotes, and list nesting', () => {
    const source = fence(card)
    for (const input of [
      source.replaceAll('```', '~~~~'),
      source.replace('```roadmap', '```  roadmap  '),
      source.trimEnd().split('\n').map(line => '> ' + line).join('\n'),
      '- Plan\n\n' + source.trimEnd().split('\n').map(line => '  ' + line).join('\n')
    ]) {
      assert.equal(count(md.render(input), 'data-roadmap aria-label='), 1)
    }
  })

  it('preserves source maps and tokens across repeated rendering', () => {
    const source = fence(card)
    const [token] = md.parse(source, {})
    assert.equal(token.type, 'roadmap')
    assert.equal(token.tag, 'section')
    assert.equal(token.info, 'roadmap')
    assert.equal(token.markup, '```')
    assert.equal(token.block, true)
    assert.deepEqual(token.map, [0, source.trimEnd().split('\n').length])
    assert.deepEqual(JSON.parse(token.content), card)
    const before = JSON.stringify(token)
    const first = md.renderer.render([token], md.options, {})
    assert.equal(md.renderer.render([token], md.options, {}), first)
    assert.equal(JSON.stringify(token), before)
  })

  it('leaves ordinary lists, other languages, and examples inside larger fences unchanged', () => {
    assert.equal(md.render('1. First\n2. Second'), '<ol>\n<li>First</li>\n<li>Second</li>\n</ol>\n')
    for (const input of [fence(card).replace('```roadmap', '```json'), fence(card).replace('```roadmap', '```roadmap-example'), '````md\n' + fence(card) + '````']) {
      assert.ok(!md.render(input).includes('data-roadmap aria-label='))
    }
    assert.ok(!md.renderInline(fence(card)).includes('data-roadmap aria-label='))
  })

  it('ignores unknown JSON keys without emitting attributes or modifying prototypes', () => {
    const source = '```roadmap\n{"title":"Plan","__proto__":{"polluted":true},"onclick":"alert(1)","items":[{"title":"Start","style":"color:red"}]}\n```'
    const html = md.render(source)
    assert.ok(html.includes('data-roadmap aria-label="Plan"'))
    assert.ok(!html.includes('onclick'))
    assert.ok(!html.includes('color:red'))
    assert.equal({}.polluted, undefined)
  })
})
