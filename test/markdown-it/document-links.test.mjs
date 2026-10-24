import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import markdownit from '../../src/index.ts'
import { documentCopyName, documentFormat, officePreviewUrl } from '../../src/common/document_file.ts'

describe('document link rendering', () => {
  it('marks supported document links without loading anything or changing href/title/label', () => {
    const md = markdownit()
    for (const ext of ['docx', 'doc', 'xlsx', 'pptx', 'pdf', 'txt', 'md', 'csv', 'json']) {
      const html = md.render(`[**Report**](./report.${ext}?v=2&token=a "Title")`)
      assert.ok(html.includes(`data-document-link="${ext}"`))
      assert.ok(html.includes(`href="./report.${ext}?v=2&amp;token=a"`))
      assert.ok(html.includes('title="Title"'))
      assert.ok(html.includes('<strong>Report</strong>'))
      assert.ok(!html.includes('iframe'))
    }
  })

  it('supports references and case-insensitive path extensions, while preserving ordinary links', () => {
    const md = markdownit()
    assert.ok(md.render('[Report][id]\n\n[id]: https://example.com/file.DOCX?v=2#page').includes('data-document-link="docx"'))
    assert.equal(md.render('[Site](https://example.com/?file=report.docx)'), '<p><a href="https://example.com/?file=report.docx">Site</a></p>\n')
    for (const url of ['javascript:alert(1).docx', 'file:///report.docx', 'ftp://example.com/report.docx', 'https://user:pass@example.com/report.docx']) {
      assert.equal(documentFormat(url), null)
    }
  })

  it('can be disabled and does not alter strict preset rendering or parsed token attributes', () => {
    const input = '[Report](report.docx)'
    const expected = '<p><a href="report.docx">Report</a></p>\n'
    assert.equal(markdownit({ documentLinks: false }).render(input), expected)
    assert.equal(markdownit('commonmark').render(input), expected)
    assert.ok(markdownit('commonmark', { documentLinks: true }).render(input).includes('data-document-link'))
    const md = markdownit()
    const tokens = md.parse(input, {})
    const original = JSON.stringify(tokens)
    md.renderer.render(tokens, md.options)
    assert.equal(JSON.stringify(tokens), original)
  })

  it('builds safe copy filenames and explicit public Office preview URLs', () => {
    assert.equal(documentFormat('https://example.com/book.XLXS?version=2'), 'xlsx')
    assert.equal(documentFormat('./deck.PowerPoint'), 'pptx')
    assert.equal(documentCopyName('https://example.com/book.xlxs', 'xlsx'), 'book-副本.xlsx')
    assert.equal(documentCopyName('https://example.com/deck.powerpoint', 'pptx'), 'deck-副本.pptx')
    assert.equal(documentCopyName('https://example.com/%E6%8A%A5%E5%91%8A.docx?token=x', 'docx'), '报告-副本.docx')
    assert.ok(!documentCopyName('https://example.com/a%2Fb.docx', 'docx').includes('/'))
    const office = new URL(officePreviewUrl('https://example.com/file.xlsx?x=1&y=2'))
    assert.equal(office.searchParams.get('src'), 'https://example.com/file.xlsx?x=1&y=2')
    assert.equal(officePreviewUrl('file:///private.doc'), null)
    assert.equal(officePreviewUrl('http://localhost/private.doc'), null)
  })
})
