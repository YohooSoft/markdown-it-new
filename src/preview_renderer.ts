import { escapeHtml } from './common/utils.ts'
import { controlButtonStyle } from './control_styles.ts'
import type Token from './token.ts'

export function previewOpen (title: string, inline = false): string {
  const tag = inline ? 'span' : 'div'
  return '<' + tag + ' data-preview-container data-preview-title="' + escapeHtml(title) + '">' +
    '<' + tag + ' data-preview-toolbar><button type="button" data-preview-open aria-haspopup="dialog" aria-expanded="false" aria-label="放大预览：' +
    escapeHtml(title) + '" style="' + controlButtonStyle + '">放大预览 <span aria-hidden="true">⤢</span></button></' + tag + '>' +
    '<' + tag + ' data-preview-content>'
}

export function previewClose (inline = false): string {
  return inline ? '</span></span>' : '</div></div>\n'
}

/** Keep toolbars adjacent to their tables/lists inside a single preview. */
export function previewRanges (tokens: Token[]): { opens: Map<number, string>, closes: Set<number> } {
  const opens = new Map<number, string>()
  const closes = new Set<number>()
  const stack: Array<{ tag: string, level: number, index: number, title: string }> = []
  tokens.forEach((token, index) => {
    const isTable = token.type === 'table_open'
    const isTasks = ['ordered_list_open', 'bullet_list_open'].includes(token.type) &&
      String(token.attrGet('class') ?? '').split(/\s+/).includes('contains-task-list')
    if (isTable || isTasks) {
      const menu = isTable ? 'table_controls_menu' : 'task_list_menu'
      stack.push({ tag: token.tag, level: token.level, index: tokens[index - 1]?.type === menu ? index - 1 : index, title: isTable ? '表格' : '待办事项' })
    } else if (token.nesting === -1) {
      const opening = stack[stack.length - 1]
      if (opening && opening.tag === token.tag && opening.level === token.level) {
        opens.set(opening.index, opening.title)
        closes.add(index)
        stack.pop()
      }
    }
  })
  return { opens, closes }
}
