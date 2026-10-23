import type StateInline from './state_inline.ts'

function findUnescaped (source: string, marker: string, from: number): number {
  for (let pos = from; pos < source.length; pos++) {
    if (source.startsWith(marker, pos) && source[pos - 1] !== '\\') {
      return pos
    }
  }
  return -1
}

export default function math_inline (state: StateInline, silent: boolean): boolean {
  if (!state.md.options.math || state.src[state.pos] !== '$' || state.src[state.pos + 1] === '$') {
    return false
  }

  const start = state.pos + 1
  const end = findUnescaped(state.src, '$', start)
  if (end < 0 || end === start || state.src.slice(start, end).includes('\n')) {
    return false
  }

  const content = state.src.slice(start, end)
  if (/^\s|\s$/.test(content)) { return false }
  if (!silent) {
    const token = state.push('math_inline', 'math', 0)
    token.content = content
  }
  state.pos = end + 1
  return true
}
