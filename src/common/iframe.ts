import { escapeHtml, unescapeAll } from './utils.ts'

/** A matched iframe source and its sanitized HTML representation. */
export interface IframeMatch {
  source: string
  length: number
  html: string | null
}

const IFRAME_RE = /^<iframe\b([^>]*)>(?:[\s\S]*?)<\/iframe\s*>/i
const IFRAME_SELF_CLOSING_RE = /^<iframe\b([^>]*)\/\s*>/i
const ATTRIBUTE_RE = /([a-zA-Z_:][a-zA-Z0-9:._-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

const SAFE_ATTRIBUTES = [
  'title',
  'width',
  'height',
  'loading',
  'referrerpolicy',
  'allow',
  'scrolling',
  'frameborder'
]

/**
 * Match an iframe at the beginning of a source string.
 *
 * When iframe support is enabled, only absolute HTTPS sources are emitted.
 * The parser intentionally ignores all attributes outside the small allowlist
 * below, including srcdoc and event-handler attributes.
 */
export default function matchIframe (source: string): IframeMatch | null {
  const match = source.match(IFRAME_RE) ?? source.match(IFRAME_SELF_CLOSING_RE)
  if (!match) { return null }

  const attributes = new Map<string, string>()
  let src: string | undefined
  let allowFullscreen = false
  let attrMatch: RegExpExecArray | null

  ATTRIBUTE_RE.lastIndex = 0
  while ((attrMatch = ATTRIBUTE_RE.exec(match[1])) !== null) {
    const name = attrMatch[1].toLowerCase()
    const value = unescapeAll(attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '')

    if (name === 'src' && src === undefined) {
      src = value
    } else if (name === 'allowfullscreen') {
      allowFullscreen = true
    } else if (SAFE_ATTRIBUTES.includes(name) && !attributes.has(name)) {
      attributes.set(name, value)
    }
  }

  let safeSrc: string | undefined
  if (src) {
    try {
      const url = new URL(src.trim())
      if (url.protocol === 'https:') {
        safeSrc = url.toString()
      }
    } catch {
      // Invalid URLs are returned as escaped source text below.
    }
  }

  let html: string | null = null
  if (safeSrc) {
    const outputAttributes = [`src="${escapeHtml(safeSrc)}"`]
    for (const name of SAFE_ATTRIBUTES) {
      const value = attributes.get(name)
      if (value !== undefined) {
        outputAttributes.push(`${name}="${escapeHtml(value)}"`)
      }
    }
    if (allowFullscreen) {
      outputAttributes.push('allowfullscreen')
    }
    html = `<iframe ${outputAttributes.join(' ')}></iframe>`
  }

  return {
    source: match[0],
    length: match[0].length,
    html
  }
}
