// Interactive table filter and sort controls

import type Token from '../token.ts'
import type StateCore from './state_core.ts'

interface HeaderControl {
  insertIndex: number
  column: number
}

interface TableInfo {
  openIndex: number
  headers: string[]
  headerControls: HeaderControl[]
  rowCount: number
}

function addClass (token: Pick<Token, 'attrGet' | 'attrJoin'>, className: string): void {
  const current = token.attrGet('class')
  if (typeof current === 'string' && current.split(/\s+/).includes(className)) {
    return
  }
  token.attrJoin('class', className)
}

/** Adds metadata and toolbar/control tokens to rendered Markdown tables. */
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
      current = { openIndex: i, headers: [], headerControls: [], rowCount: 0 }
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
    if (token.type === 'th_close' && inHead) {
      current.headerControls.push({
        insertIndex: i,
        column: current.headers.length - 1
      })
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

  const insertions: Array<{ index: number, token: Token }> = []

  for (const table of tables.filter(table => table.headers.length > 0)) {
    const menu = new state.Token('table_controls_menu', 'div', 0)
    menu.block = true
    menu.meta = {
      headers: table.headers,
      rowCount: table.rowCount
    }
    insertions.push({ index: table.openIndex, token: menu })

    for (const control of table.headerControls) {
      const column = new state.Token('table_column_controls', 'div', 0)
      column.block = true
      column.meta = {
        header: table.headers[control.column] ?? '',
        column: control.column
      }
      insertions.push({ index: control.insertIndex, token: column })
    }
  }

  // Insert from the end so recorded token indexes remain stable.
  insertions
    .sort((left, right) => right.index - left.index)
    .forEach(({ index, token }) => tokens.splice(index, 0, token))
}
