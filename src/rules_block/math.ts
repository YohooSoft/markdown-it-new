import type StateBlock from './state_block.ts'

export default function math_block (state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if (!state.md.options.math) { return false }

  const start = state.bMarks[startLine] + state.tShift[startLine]
  const max = state.eMarks[startLine]
  const firstLine = state.src.slice(start, max).trim()
  if (!firstLine.startsWith('$$')) { return false }

  let nextLine = startLine
  let content = ''
  const firstContent = firstLine.slice(2)
  if (firstContent.endsWith('$$')) {
    content = firstContent.slice(0, -2).trim()
    nextLine = startLine + 1
  } else {
    content = firstContent.trim()
    nextLine++
    for (; nextLine < endLine; nextLine++) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine]
      const line = state.src.slice(lineStart, state.eMarks[nextLine]).trim()
      if (line.endsWith('$$')) {
        const lastContent = line.slice(0, -2).trim()
        content += (content ? '\n' : '') + lastContent
        nextLine++
        break
      }
      content += (content ? '\n' : '') + line
    }
  }

  if (silent) { return true }
  state.line = nextLine
  const token = state.push('math_block', 'math', 0)
  token.map = [startLine, state.line]
  token.content = content
  return true
}
