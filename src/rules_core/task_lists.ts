// GFM-style task list items

import type StateCore from './state_core.ts'

const TASK_MARKER_RE = /^\[([ xX])\](?:\s+|$)/

function addClass (token: { attrGet: (name: string) => string | number | null, attrJoin: (name: string, value: string) => void }, className: string): void {
  const current = token.attrGet('class')
  if (typeof current === 'string' && current.split(/\s+/).includes(className)) {
    return
  }
  token.attrJoin('class', className)
}

/**
 * Converts `[ ]` / `[x]` markers at the start of list items into checkbox
 * tokens. The list parser itself remains responsible for ordered numbering.
 */
export default function task_lists (state: StateCore): void {
  if (!state.md.options.taskLists) { return }

  const tokens = state.tokens
  const listStack: number[] = []
  const itemStack: number[] = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === 'ordered_list_open' || token.type === 'bullet_list_open') {
      listStack.push(i)
      continue
    }

    if (token.type === 'list_item_open') {
      itemStack.push(i)
      continue
    }

    if (token.type === 'inline' && itemStack.length > 0 && token.children) {
      const marker = token.content.match(TASK_MARKER_RE)
      const firstTextIndex = token.children.findIndex(child => child.type === 'text')
      const firstText = firstTextIndex >= 0 ? token.children[firstTextIndex] : undefined

      if (marker && firstText && firstText.content.startsWith(marker[0])) {
        const checked = marker[1].toLowerCase() === 'x'
        const remaining = firstText.content.slice(marker[0].length)

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

        const itemOpen = tokens[itemStack[itemStack.length - 1]]
        addClass(itemOpen, 'task-list-item')

        const listOpen = tokens[listStack[listStack.length - 1]]
        addClass(listOpen, 'contains-task-list')
      }
    }

    if (token.type === 'list_item_close') {
      itemStack.pop()
    } else if (token.type === 'ordered_list_close' || token.type === 'bullet_list_close') {
      listStack.pop()
    }
  }
}
