// GFM-style task list items

import type Token from '../token.ts'
import type StateCore from './state_core.ts'

const TASK_MARKER_RE = /^\[([ xX])\](?:\s+|$)/

interface TaskListItem {
  tokenIndex: number
  status: 'pending' | 'completed' | 'other'
}

interface TaskList {
  openIndex: number
  items: TaskListItem[]
  taskCount: number
}

interface OpenTaskListItem {
  item: TaskListItem
  list: TaskList
}

function addClass (token: Pick<Token, 'attrGet' | 'attrJoin'>, className: string): void {
  const current = token.attrGet('class')
  if (typeof current === 'string' && current.split(/\s+/).includes(className)) {
    return
  }
  token.attrJoin('class', className)
}

/**
 * Converts `[ ]` / `[x]` markers at the start of list items and table cells
 * into checkbox tokens. The list parser itself remains responsible for
 * ordered numbering.
 */
export default function task_lists (state: StateCore): void {
  if (!state.md.options.taskLists) { return }

  const tokens = state.tokens
  const lists: TaskList[] = []
  const listStack: TaskList[] = []
  const itemStack: OpenTaskListItem[] = []
  const tableCellStack: number[] = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === 'ordered_list_open' || token.type === 'bullet_list_open') {
      const list = { openIndex: i, items: [], taskCount: 0 }
      lists.push(list)
      listStack.push(list)
      continue
    }

    if (token.type === 'list_item_open') {
      const list = listStack[listStack.length - 1]
      if (list) {
        const item: TaskListItem = {
          tokenIndex: i,
          status: 'other'
        }
        list.items.push(item)
        itemStack.push({ item, list })
      }
      continue
    }

    if (token.type === 'th_open' || token.type === 'td_open') {
      tableCellStack.push(i)
      continue
    }

    if (token.type === 'inline' && (itemStack.length > 0 || tableCellStack.length > 0) && token.children) {
      const marker = token.content.match(TASK_MARKER_RE)
      const firstTextIndex = token.children.findIndex(child => child.type === 'text')
      const firstText = firstTextIndex >= 0 ? token.children[firstTextIndex] : undefined

      if (marker && firstText && firstText.content.startsWith(marker[0])) {
        const checked = marker[1].toLowerCase() === 'x'
        const remaining = firstText.content.slice(marker[0].length)

        if (itemStack.length > 0) {
          const openItem = itemStack[itemStack.length - 1]
          openItem.item.status = checked ? 'completed' : 'pending'
          openItem.list.taskCount++
          addClass(tokens[openItem.item.tokenIndex], 'task-list-item')
        } else {
          const cell = tokens[tableCellStack[tableCellStack.length - 1]]
          addClass(cell, 'task-cell')
          cell.attrSet('data-task-status', checked ? 'completed' : 'pending')
        }

        if (remaining) {
          firstText.content = remaining
        } else {
          token.children.splice(firstTextIndex, 1)
        }

        const checkbox = new state.Token('task_checkbox', 'input', 0)
        checkbox.meta = { checked }
        checkbox.level = token.level

        const spacer = new state.Token('text', '', 0)
        spacer.content = ' '
        spacer.level = token.level

        token.children.splice(firstTextIndex, 0, checkbox, spacer)
        token.content = token.content.slice(marker[0].length)
      }
    }

    if (token.type === 'list_item_close') {
      itemStack.pop()
    } else if (token.type === 'ordered_list_close' || token.type === 'bullet_list_close') {
      listStack.pop()
    } else if (token.type === 'th_close' || token.type === 'td_close') {
      tableCellStack.pop()
    }
  }

  const controlledLists = lists.filter(list => list.taskCount > 0)

  for (const list of controlledLists) {
    const listOpen = tokens[list.openIndex]
    addClass(listOpen, 'contains-task-list')

    if (!state.md.options.taskListControls) { continue }

    addClass(listOpen, 'task-list-controlled')
    listOpen.attrSet('data-task-list', '')

    for (let i = 0; i < list.items.length; i++) {
      const item = list.items[i]
      const itemOpen = tokens[item.tokenIndex]
      itemOpen.attrSet('data-task-index', i)
      itemOpen.attrSet('data-task-status', item.status)
    }
  }

  if (!state.md.options.taskListControls) { return }

  // Insert from the end so recorded token indexes remain valid.
  controlledLists
    .sort((a, b) => b.openIndex - a.openIndex)
    .forEach(list => {
      const menu = new state.Token('task_list_menu', 'div', 0)
      menu.block = true
      menu.meta = {
        total: list.taskCount,
        pending: list.items.filter(item => item.status === 'pending').length,
        completed: list.items.filter(item => item.status === 'completed').length
      }
      tokens.splice(list.openIndex, 0, menu)
    })
}
