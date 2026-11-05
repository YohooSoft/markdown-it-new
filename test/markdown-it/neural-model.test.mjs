import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import markdownit from '../../src/index.ts'
import { modelWebUrl, neuralModelFormat, neuralViewerUrl } from '../../src/common/neural_model.ts'

describe('neural-network model images', () => {
  const md = markdownit({ expandPreview: false })

  it('recognizes supported formats through the existing image syntax', () => {
    for (const ext of ['onnx', 'pt', 'pth', 'torchscript', 'tflite', 'pb', 'h5', 'keras', 'safetensors']) {
      const html = md.render(`![Network](https://example.com/model.${ext})`)
      assert.ok(html.includes(`data-neural-model-format="${ext}"`))
      assert.ok(html.includes('data-neural-model-toggle aria-expanded="false"'))
      assert.ok(html.includes('data-neural-model-slot hidden'))
      assert.ok(!html.includes('<iframe'))
      assert.ok(!html.includes('<img'))
    }
  })

  it('supports reference images, uppercase extensions, queries, and fragments', () => {
    const html = md.render('![Network][model]\n\n[model]: https://example.com/model.ONNX?version=2#weights "Description"')
    assert.ok(html.includes('data-neural-model-format="onnx"'))
    assert.ok(html.includes('title="Description"'))
    assert.equal(neuralModelFormat('https://example.com/path.onnx/image.png'), null)
    assert.equal(neuralModelFormat('https://example.com/image.png?file=model.onnx'), null)
  })

  it('keeps inline cards valid and preserves linked images without nested interactive elements', () => {
    const html = md.render('Before ![Network](./model.pt) after')
    assert.ok(html.includes('data-neural-model-source="./model.pt"'))
    assert.ok(!html.includes('<div'))
    assert.ok(!html.includes('<section'))
    const linked = md.render('[![Network](./model.pt)](/details)')
    assert.equal(linked, '<p><a href="/details"><img src="./model.pt" alt="Network"></a></p>\n')
  })

  it('escapes names, titles, and model URL attributes', () => {
    const html = md.render('![<b>network</b>](https://example.com/model.onnx?a=1&b=2 "a &quot;title&quot;")')
    assert.ok(html.includes('&lt;b&gt;network&lt;/b&gt;'))
    assert.ok(html.includes('?a=1&amp;b=2'))
    assert.ok(html.includes('title="a &quot;title&quot;"'))
    assert.ok(!html.includes('<b>'))
  })

  it('can be disabled and stays opt-in for strict and zero presets', () => {
    const input = '![Network](model.onnx)'
    const expected = '<p><img src="model.onnx" alt="Network"></p>\n'
    assert.equal(markdownit({ neuralModels: false, expandPreview: false }).render(input), expected)
    assert.equal(markdownit('commonmark').render(input), expected.replace('alt="Network">', 'alt="Network" />'))
    assert.ok(!markdownit('zero').enable('image').render(input).includes('data-neural-model'))
    assert.ok(markdownit('commonmark', { neuralModels: true }).render(input).includes('data-neural-model'))
  })

  it('preserves ordinary images and GLB/GLTF rendering', () => {
    assert.equal(md.render('![Photo](photo.png)'), '<p><img src="photo.png" alt="Photo"></p>\n')
    for (const ext of ['glb', 'gltf']) {
      const html = md.render(`![Scene](scene.${ext})`)
      assert.ok(html.includes('<model-viewer'))
      assert.ok(!html.includes('data-neural-model'))
    }
  })

  it('rejects unsafe model and viewer protocols and credentials', () => {
    for (const source of ['javascript:alert(1).onnx', 'data:text/plain,model.pt', 'file:///model.pt', 'ftp://example.com/model.pt', 'https://user:password@example.com/model.pt']) {
      assert.equal(neuralModelFormat(source), null)
      assert.ok(!md.render(`![Network](${source})`).includes('data-neural-model'))
    }
    for (const viewer of ['javascript:alert(1)', 'data:text/html,test', 'http://untrusted.example/', '//example.com/', 'https://user:password@example.com/']) {
      assert.equal(neuralViewerUrl('https://example.com/model.pt', viewer), null)
      assert.ok(!markdownit({ neuralModelViewerUrl: viewer }).render('![Network](model.onnx)').includes('data-neural-model'))
    }
  })

  it('builds encoded Netron URLs and resolves relative models against the host page', () => {
    const source = '../models/network.ONNX?token=a%26b&version=2#weights'
    const viewer = new URL(neuralViewerUrl(source, 'https://viewer.example/netron/?theme=light&url=old#old', 'https://docs.example/guide/page.html'))
    assert.equal(viewer.searchParams.get('url'), 'https://docs.example/models/network.ONNX?token=a%26b&version=2#weights')
    assert.equal(viewer.searchParams.get('theme'), 'light')
    assert.equal(viewer.hash, '')
    assert.equal(neuralViewerUrl('./model.pt', 'https://netron.app/'), 'https://netron.app/')
    assert.equal(modelWebUrl('./model.pt', 'file:///docs/page.html'), null)
    assert.ok(neuralViewerUrl('https://example.com/model.pt', 'http://127.0.0.1:8080/'))
  })
})
