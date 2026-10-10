// Process html tags

import { escapeHtml } from '../common/utils.ts'
import matchIframe from '../common/iframe.ts'
import { HTML_TAG_RE } from '../common/html_re.ts'
import type StateInline from './state_inline.ts'

function isLinkOpen (str: string) {
  return /^<a[>\s]/i.test(str)
}
function isLinkClose (str: string) {
  return /^<\/a\s*>/i.test(str)
}

function isLetter (ch: number) {
  /* eslint no-bitwise:0 */
  const lc = ch | 0x20 // to lower case
  return (lc >= 0x61/* a */) && (lc <= 0x7a/* z */)
}

export default function html_inline (state: StateInline, silent: boolean): boolean {
  // Check start
  const max = state.posMax
  const pos = state.pos
  if (state.src.charCodeAt(pos) !== 0x3C/* < */ ||
      pos + 2 >= max) {
    return false
  }

  if (state.md.options.iframe) {
    const iframe = matchIframe(state.src.slice(pos))
    if (iframe) {
      if (!silent) {
        const token = state.push('iframe_inline', '', 0)
        token.content = iframe.html ?? escapeHtml(iframe.source)
      }
      state.pos += iframe.length
      return true
    }
  }

  if (!state.md.options.html) { return false }

  // Quick fail on second char
  const ch = state.src.charCodeAt(pos + 1)
  if (ch !== 0x21/* ! */ &&
      ch !== 0x3F/* ? */ &&
      ch !== 0x2F/* / */ &&
      !isLetter(ch)) {
    return false
  }

  const match = state.src.slice(pos).match(HTML_TAG_RE)
  if (!match) { return false }

  if (!silent) {
    const token = state.push('html_inline', '', 0)
    token.content = match[0]

    if (isLinkOpen(token.content)) state.linkLevel++
    if (isLinkClose(token.content)) state.linkLevel--
  }
  state.pos += match[0].length
  return true
}
