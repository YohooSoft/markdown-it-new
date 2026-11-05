import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { constrainWindow, resizeWindow } from '../../src/preview_window.ts'

describe('preview window geometry', () => {
  const bounds = { width: 1280, height: 900 }
  const rect = { left: 100, top: 80, width: 800, height: 600 }

  it('keeps dragged windows inside the viewport', () => {
    assert.deepEqual(constrainWindow({ ...rect, left: -500, top: 2000 }, bounds), { ...rect, left: 8, top: 292 })
  })

  it('resizes all eight edges/corners and anchors the opposite sides', () => {
    for (const edge of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
      const resized = resizeWindow(rect, edge, 40, 30, bounds)
      assert.equal(resized.left, edge.includes('w') ? 140 : 100)
      assert.equal(resized.top, edge.includes('n') ? 110 : 80)
      assert.equal(resized.left + resized.width, edge.includes('e') ? 940 : 900)
      assert.equal(resized.top + resized.height, edge.includes('s') ? 710 : 680)
    }
  })

  it('enforces minimum sizes and viewport boundaries when resizing past an opposite edge', () => {
    assert.deepEqual(resizeWindow(rect, 'se', -10000, -10000, bounds), { ...rect, width: 360, height: 240 })
    assert.deepEqual(resizeWindow(rect, 'nw', 10000, 10000, bounds), { left: 540, top: 440, width: 360, height: 240 })
    const large = resizeWindow(rect, 'se', 10000, 10000, bounds)
    assert.equal(large.left + large.width, 1272)
    assert.equal(large.top + large.height, 892)
  })

  it('fits narrow touch screens even when smaller than the normal minimum size', () => {
    assert.deepEqual(constrainWindow(rect, { width: 320, height: 200 }), { left: 8, top: 8, width: 304, height: 184 })
  })
})
