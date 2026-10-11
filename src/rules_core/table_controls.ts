// Interactive table filter and sort controls

import type Token from '../token.ts'
import type StateCore from './state_core.ts'

interface TableInfo {
  openIndex: number
  headers: string[]
  rowCount: number
}

function addClass (token: Pick<Token, 'attrGet' | 'attrJoin'>, className: string): void {
  const current = token.attrGet('class')
  if (typeof current === 'string' && current.split(/\s+/).includes(className)) {
    return
  }
  token.attrJoin('class', className)
}

/** Adds metadata and a toolbar token to rendered Markdown tables. */
export default function table_controls (state: StateCore): void {
  if (!state.md.options.tableControls) { return }

  const tokens = state.tokens
  const tables: TableInfo[] = []
  let current: TableInfo | null = null
  let inHead = false
  let inBody = false

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === 'table_open') {
      current = { openIndex: i, headers: [], rowCount: 0 }
      tables.push(current)
      continue
    }

    if (!current) { continue }

    if (token.type === 'thead_open') {
      inHead = true
      continue
    }
    if (token.type === 'thead_close') {
      inHead = false
      continue
    }
    if (token.type === 'tbody_open') {
      inBody = true
      continue
    }
    if (token.type === 'tbody_close') {
      inBody = false
      continue
    }
    if (token.type === 'tr_open') {
      if (inBody) { current.rowCount++ }
      continue
    }
    if (token.type === 'inline' && inHead) {
      current.headers.push(token.content.trim())
      continue
    }
    if (token.type === 'table_close') {
      const tableOpen = tokens[current.openIndex]
      addClass(tableOpen, 'table-controlled')
      tableOpen.attrSet('data-table-controlled', '')
      tableOpen.attrSet('data-table-columns', current.headers.length)

      current = null
      inHead = false
      inBody = false
    }
  }

  // Insert menus after scanning so token indexes remain stable.
  const menuPositions = tables
    .filter(table => table.headers.length > 0)
    .sort((a, b) => b.openIndex - a.openIndex)

  for (const table of menuPositions) {
    const menu = new state.Token('table_controls_menu', 'div', 0)
    menu.block = true
    menu.meta = {
      headers: table.headers,
      rowCount: table.rowCount
    }
    tokens.splice(table.openIndex, 0, menu)
  }
}
