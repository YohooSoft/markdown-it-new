const formats: Record<string, string> = {
  onnx: 'ONNX',
  pt: 'PyTorch',
  pth: 'PyTorch',
  torchscript: 'TorchScript',
  tflite: 'TensorFlow Lite',
  pb: 'TensorFlow',
  h5: 'Keras',
  keras: 'Keras',
  safetensors: 'Safetensors'
}

/** Accept web URLs and relative web paths, never executable or local-file URLs. */
export function modelWebUrl (source: string, base?: string): URL | null {
  try {
    const url = base ? new URL(source, base) : new URL(source)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) { return null }
    return url
  } catch {
    return null
  }
}

export function neuralModelFormat (source: string): { extension: string, label: string } | null {
  const url = modelWebUrl(source, 'https://markdown.local/')
  if (!url) { return null }
  const extension = url.pathname.split('.').pop()?.toLowerCase() ?? ''
  return Object.prototype.hasOwnProperty.call(formats, extension) ? { extension, label: formats[extension] } : null
}

/** Only HTTPS or a local development server can host the viewer. */
export function neuralViewerUrl (source: string, viewer: string, base?: string): string | null {
  const url = modelWebUrl(viewer)
  if (!url || (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    return null
  }
  // Netron accepts a model URL in the fragment; remove a configured fragment
  // so it cannot override the selected model's query parameter.
  url.hash = ''
  url.searchParams.delete('url')
  const model = modelWebUrl(source, base)
  if (model) { url.searchParams.set('url', model.href) }
  return url.href
}
