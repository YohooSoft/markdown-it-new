import { escapeHtml, unescapeAll } from './utils.ts'

/** A matched safe image tag and its sanitized HTML representation. */
export interface ImageMatch {
  source: string
  length: number
  html: string | null
}

const IMAGE_RE = /^<img\b([^>]*)\/?\s*>/i
const ATTRIBUTE_RE = /([a-zA-Z_:][a-zA-Z0-9:._-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
const SAFE_ATTRIBUTES = ['alt', 'title', 'width', 'height', 'loading', 'decoding', 'referrerpolicy']

/** Match and sanitize a standalone or inline HTML image tag. */
export default function matchImage (source: string): ImageMatch | null {
  const match = source.match(IMAGE_RE)
  if (!match) { return null }

  const attributes = new Map<string, string>()
  let src: string | undefined
  let attrMatch: RegExpExecArray | null

  ATTRIBUTE_RE.lastIndex = 0
  while ((attrMatch = ATTRIBUTE_RE.exec(match[1])) !== null) {
    const name = attrMatch[1].toLowerCase()
    const value = unescapeAll(attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '')
    if (name === 'src' && src === undefined) {
      src = value
    } else if (SAFE_ATTRIBUTES.includes(name) && !attributes.has(name)) {
      attributes.set(name, value)
    }
  }

  let safeSrc: string | undefined
  if (src) {
    try {
      const url = new URL(src.trim())
      if (url.protocol === 'https:') { safeSrc = url.toString() }
    } catch {
      // Invalid URLs remain escaped source text.
    }
  }

  if (!safeSrc) {
    return { source: match[0], length: match[0].length, html: null }
  }

  const outputAttributes = [`src="${escapeHtml(safeSrc)}"`]
  for (const name of SAFE_ATTRIBUTES) {
    const value = attributes.get(name)
    if (value !== undefined) { outputAttributes.push(`${name}="${escapeHtml(value)}"`) }
  }
  if (!attributes.has('alt')) { outputAttributes.push('alt=""') }

  return {
    source: match[0],
    length: match[0].length,
    html: `<img ${outputAttributes.join(' ')}>`
  }
}
