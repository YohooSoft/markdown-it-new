import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const md = require('../../')()

describe('CJS', () => {
  it('require', () => {
    assert.strictEqual(md.render('abc'), '<p>abc</p>\n')
  })

  it('renders roadmap cards through the built package', () => {
    const html = md.render('```roadmap\n{"title":"Plan","items":[{"title":"Start"}]}\n```')
    assert.ok(html.includes('data-roadmap aria-label="Plan"'))
    assert.ok(html.includes('data-preview-title="路线图"'))
  })
})
