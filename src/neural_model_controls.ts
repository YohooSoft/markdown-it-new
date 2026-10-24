import { modelWebUrl, neuralViewerUrl } from './common/neural_model.ts'

function handleNeuralModelClick (event: Event): void {
  const element = event.target
  if (!(element instanceof Element)) { return }
  const target = element.closest<HTMLElement>('[data-neural-model-toggle], [data-neural-model-open]')
  const card = target?.closest<HTMLElement>('[data-neural-model]')
  if (!target || !card) { return }
  const doc = card.ownerDocument
  const source = modelWebUrl(card.dataset.neuralModelSource ?? '', doc.baseURI)
  const viewer = source && neuralViewerUrl(source.href, card.dataset.neuralModelViewer ?? '')
  const status = card.querySelector<HTMLElement>('[data-neural-model-status]')
  if (!viewer) {
    event.preventDefault()
    if (status) { status.textContent = '请通过 HTTP(S) 页面访问模型，或下载文件后在 Netron 中打开。' }
    return
  }
  if (target.matches('[data-neural-model-open]')) {
    target.setAttribute('href', viewer)
    return
  }
  const slot = card.querySelector<HTMLElement>('[data-neural-model-slot]')
  if (!slot) { return }
  const opening = slot.hidden
  if (opening && !slot.querySelector('iframe')) {
    const frame = doc.createElement('iframe')
    frame.title = card.dataset.neuralModelTitle || '神经网络模型预览'
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-downloads')
    frame.referrerPolicy = 'no-referrer'
    frame.style.cssText = 'display:block;width:100%;height:min(70vh,640px);min-height:360px;border:0;background:#fff;'
    frame.src = viewer
    slot.append(frame)
  }
  slot.hidden = !opening
  target.setAttribute('aria-expanded', String(opening))
  target.textContent = opening ? '收起预览' : '查看模型'
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', handleNeuralModelClick)
}

export {}
