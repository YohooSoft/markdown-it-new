import { unescapeAll, escapeHtml } from './common/utils.ts'
import type Token from './token.ts'
import type { Env, MarkdownItOptions } from './types.ts'

/** Function that renders a token at a given position in a token stream. */
export type RendererRule = (
  tokens: Token[],
  idx: number,
  options: Required<MarkdownItOptions>,
  env: Env | undefined,
  renderer: Renderer
) => string

const default_rules: Record<string, RendererRule> = {}

default_rules.code_inline = function (
  tokens: Token[],
  idx: number,
  options: Required<MarkdownItOptions>,
  env: Env | undefined,
  slf: Renderer
): string {
  const token = tokens[idx]

  return `<code${slf.renderAttrs(token)}>${escapeHtml(token.content)}</code>`
}

default_rules.code_block = function (
  tokens: Token[],
  idx: number,
  options: Required<MarkdownItOptions>,
  env: Env | undefined,
  slf: Renderer
): string {
  const token = tokens[idx]

  return `<pre${slf.renderAttrs(token)}><code>${escapeHtml(tokens[idx].content)}</code></pre>\n`
}

default_rules.fence = function (
  tokens: Token[],
  idx: number,
  options: Required<MarkdownItOptions>,
  env: Env | undefined,
  slf: Renderer
): string {
  const token = tokens[idx]
  const info = token.info ? unescapeAll(token.info).trim() : ''
  let langName = ''
  let langAttrs = ''

  if (info) {
    const arr = info.split(/(\s+)/g)
    langName = arr[0]
    langAttrs = arr.slice(2).join('')
  }

  let highlighted
  if (options.highlight) {
    highlighted = options.highlight(token.content, langName, langAttrs) || escapeHtml(token.content)
  } else {
    highlighted = escapeHtml(token.content)
  }

  if (highlighted.indexOf('<pre') === 0) {
    return highlighted + '\n'
  }

  // If language exists, inject class gently, without modifying original token.
  // May be, one day we will add .deepClone() for token and simplify this part, but
  // now we prefer to keep things local.
  if (info) {
    const i = token.attrIndex('class')
    const tmpAttrs = token.attrs ? token.attrs.slice() : []

    if (i < 0) {
      tmpAttrs.push(['class', `${options.langPrefix}${langName}`])
    } else {
      tmpAttrs[i] = [tmpAttrs[i][0], tmpAttrs[i][1]] // shallow clone
      tmpAttrs[i][1] += ` ${options.langPrefix}${langName}`
    }

    // Fake token just to render attributes
    const tmpToken = {
      attrs: tmpAttrs
    }

    return `<pre><code${slf.renderAttrs(tmpToken)}>${highlighted}</code></pre>\n`
  }

  return `<pre><code${slf.renderAttrs(token)}>${highlighted}</code></pre>\n`
}

default_rules.image = function (
  tokens: Token[],
  idx: number,
  options: Required<MarkdownItOptions>,
  env: Env | undefined,
  slf: Renderer
): string {
  const token = tokens[idx]

  // "alt" attr MUST be set, even if empty. Because it's mandatory and
  // should be placed on proper position for tests.
  //
  // Replace content with actual value

  token.attrs![token.attrIndex('alt')][1] =
    slf.renderInlineAsText(token.children!, options, env)

  return slf.renderToken(tokens, idx, options)
}

default_rules.hardbreak = function (
  tokens: Token[],
  idx: number,
  options: Required<MarkdownItOptions>
): string {
  return options.xhtmlOut ? '<br />\n' : '<br>\n'
}
default_rules.softbreak = function (
  tokens: Token[],
  idx: number,
  options: Required<MarkdownItOptions>
): string {
  return options.breaks ? (options.xhtmlOut ? '<br />\n' : '<br>\n') : '\n'
}

default_rules.text = function (tokens: Token[], idx: number): string {
  return escapeHtml(tokens[idx].content)
}

default_rules.html_block = function (tokens: Token[], idx: number): string {
  return tokens[idx].content
}
default_rules.html_inline = function (tokens: Token[], idx: number): string {
  return tokens[idx].content
}
default_rules.iframe_block = function (tokens: Token[], idx: number): string {
  return `${tokens[idx].content}\n`
}
default_rules.iframe_inline = function (tokens: Token[], idx: number): string {
  return tokens[idx].content
}
default_rules.task_checkbox = function (
  tokens: Token[],
  idx: number,
  options: Required<MarkdownItOptions>
): string {
  const checked = tokens[idx].meta?.checked === true
  const close = options.xhtmlOut ? ' />' : '>'
  return `<input class="task-list-item-checkbox" type="checkbox"${checked ? ' checked' : ''} disabled${close}`
}
default_rules.task_list_menu = function (tokens: Token[], idx: number): string {
  const total = Number(tokens[idx].meta?.total ?? 0)
  const pending = Number(tokens[idx].meta?.pending ?? 0)
  const selectStyle = 'min-width:112px;max-width:100%;padding:6px 28px 6px 9px;' +
    'border:1px solid rgba(148,163,184,.38);border-radius:8px;background:#fff;' +
    'color:#334155;font:inherit;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.04);'

  return '<div class="task-list-menu" data-task-list-menu role="toolbar" aria-label="待办事项菜单" ' +
    'style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;' +
    'gap:10px 16px;margin:10px 0 8px;padding:10px 12px;border:1px solid rgba(148,163,184,.28);' +
    'border-radius:12px;background:linear-gradient(135deg,rgba(248,250,252,.94),rgba(241,245,249,.78));' +
    'box-shadow:0 6px 20px rgba(15,23,42,.06);color:#334155;' +
    'font:500 14px/1.4 system-ui,-apple-system,&quot;Segoe UI&quot;,sans-serif">' +
    '<div style="display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 10px">' +
    '<strong style="color:#0f172a;font-size:14px;font-weight:700">待办事项</strong>' +
    `<span data-task-list-summary style="color:#64748b;font-size:12px">共 ${total} 项 · ${pending} 项未完成</span>` +
    '</div>' +
    '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px">' +
    '<label class="task-list-menu-field" style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap">' +
    '<span>筛选</span>' +
    `<select class="task-list-filter" data-task-list-filter aria-label="筛选待办事项" style="${selectStyle}">` +
    '<option value="all">全部</option>' +
    '<option value="pending">未完成</option>' +
    '<option value="completed">已完成</option>' +
    '</select></label>' +
    '<label class="task-list-menu-field" style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap">' +
    '<span>排序</span>' +
    `<select class="task-list-sort" data-task-list-sort aria-label="排序待办事项" style="${selectStyle}">` +
    '<option value="original">原顺序</option>' +
    '<option value="pending-first">未完成优先</option>' +
    '<option value="completed-first">已完成优先</option>' +
    '</select></label>' +
    '</div></div>\n'
}
default_rules.table_controls_menu = function (tokens: Token[], idx: number): string {
  const meta = tokens[idx].meta ?? {}
  const headers = Array.isArray(meta.headers) ? meta.headers.map(String) : []
  const rowCount = Number(meta.rowCount ?? 0)
  const inputStyle = 'width:100%;min-width:0;padding:7px 9px;border:1px solid rgba(148,163,184,.38);' +
    'border-radius:8px;background:#fff;color:#334155;font:inherit;box-sizing:border-box;'
  const selectStyle = 'width:100%;padding:7px 9px;border:1px solid rgba(148,163,184,.38);' +
    'border-radius:8px;background:#fff;color:#334155;font:inherit;cursor:pointer;box-sizing:border-box;'
  const columns = headers.map((header, column) => {
    const label = escapeHtml(header.trim() || `第 ${column + 1} 列`)
    return '<div class="table-menu-column" style="display:grid;gap:6px;padding:9px;' +
      'border:1px solid rgba(148,163,184,.24);border-radius:10px;background:rgba(255,255,255,.64)">' +
      `<strong style="overflow:hidden;color:#334155;font-size:12px;font-weight:700;text-overflow:ellipsis;white-space:nowrap" title="${label}">${label}</strong>` +
      `<input type="search" data-table-filter data-table-column="${column}" aria-label="筛选 ${label}" placeholder="筛选内容" style="${inputStyle}">` +
      `<select data-table-sort data-table-column="${column}" aria-label="排序 ${label}" style="${selectStyle}">` +
      '<option value="">不排序</option><option value="asc">升序</option><option value="desc">降序</option>' +
      '</select></div>'
  }).join('')

  const buttonStyle = 'padding:6px 10px;border:1px solid rgba(148,163,184,.38);' +
    'border-radius:8px;background:rgba(255,255,255,.72);color:#475569;' +
    'font:inherit;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.04);'

  return '<div class="table-controls-menu" data-table-controls-menu role="toolbar" aria-label="表格筛选和排序" ' +
    'style="display:grid;gap:10px;margin:10px 0 8px;padding:12px;' +
    'border:1px solid rgba(148,163,184,.28);border-radius:12px;' +
    'background:linear-gradient(135deg,rgba(248,250,252,.94),rgba(241,245,249,.78));' +
    'box-shadow:0 6px 20px rgba(15,23,42,.06);color:#334155;' +
    'font:500 14px/1.4 system-ui,-apple-system,&quot;Segoe UI&quot;,sans-serif">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">' +
    '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">' +
    '<strong style="color:#0f172a;font-size:14px;font-weight:700">表格筛选与排序</strong>' +
    `<span data-table-summary style="color:#64748b;font-size:12px">共 ${rowCount} 行 · ${headers.length} 列</span>` +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:8px">' +
    `<button type="button" data-table-reset title="恢复原始顺序并清空筛选" style="${buttonStyle}">还原</button>` +
    `<button type="button" data-table-settings aria-expanded="false" title="显示或隐藏列设置" style="${buttonStyle}">设置</button>` +
    '</div></div>' +
    `<div data-table-controls-panel hidden style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px">${columns}</div>` +
    '</div>\n'
}

/**
 * Generates HTML from parsed token stream. Each instance has independent
 * copy of rules. Those can be rewritten with ease. Also, you can add new
 * rules if you create plugin and adds new token types.
 *
 * Creates new renderer instance and fills {@link Renderer.rules} with defaults.
 */
class Renderer {
  /**
   * Contains render rules for tokens. Can be updated and extended.
   *
   * See [source code](https://github.com/markdown-it/markdown-it/blob/master/src/renderer.ts)
   * for more details and examples.
   *
   * @example Custom render rules
   * ```javascript
   * import MarkdownIt from 'markdown-it'
   * const md = new MarkdownIt()
   *
   * md.renderer.rules.strong_open  = function () { return '<b>'; };
   * md.renderer.rules.strong_close = function () { return '</b>'; };
   *
   * const result = md.renderInline(...);
   * ```
   *
   * @example Each rule is called as independent static function with fixed signature
   * ```javascript
   * function my_token_render(tokens, idx, options, env, renderer) {
   *   // ...
   *   return renderedHTML;
   * }
   * ```
   */
  rules: Record<string, RendererRule> = Object.assign({}, default_rules)

  /**
   * Render token attributes to string.
   */
  renderAttrs (token: Pick<Token, 'attrs'>): string {
    let i, l, result

    if (!token.attrs) { return '' }

    result = ''

    for (i = 0, l = token.attrs.length; i < l; i++) {
      result += ` ${escapeHtml(token.attrs[i][0])}="${escapeHtml(String(token.attrs[i][1]))}"`
    }

    return result
  }

  /**
   * Default token renderer. Can be overriden by custom function
   * in {@link Renderer.rules}.
   */
  renderToken (tokens: Token[], idx: number, options: Required<MarkdownItOptions>): string {
    const token = tokens[idx]
    let result = ''

    // Tight list paragraphs
    if (token.hidden) {
      return ''
    }

    // Insert a newline between hidden paragraph and subsequent opening
    // block-level tag.
    //
    // For example, here we should insert a newline before blockquote:
    //  - a
    //    >
    //
    // Only closing hidden tokens count, to not break on other hidden ones.
    //
    // Hidden tokens without nesting (`reference_definition`) are skipped here
    // and below, or they would break line feeds around neighbour blocks.
    //
    let prev = idx - 1
    while (prev >= 0 && tokens[prev].hidden && tokens[prev].nesting === 0) { prev-- }

    if (token.block && token.nesting !== -1 && prev >= 0 &&
        tokens[prev].hidden && tokens[prev].nesting === -1) {
      result += '\n'
    }

    // Add token name, e.g. `<img`
    result += (token.nesting === -1 ? '</' : '<') + token.tag

    // Encode attributes, e.g. `<img src="foo"`
    result += this.renderAttrs(token)

    // Add a slash for self-closing tags, e.g. `<img src="foo" /`
    if (token.nesting === 0 && options.xhtmlOut) {
      result += ' /'
    }

    // Check if we need to add a newline after this tag
    let needLf = false
    if (token.block) {
      needLf = true

      if (token.nesting === 1) {
        let next = idx + 1
        while (next < tokens.length && tokens[next].hidden && tokens[next].nesting === 0) { next++ }

        if (next < tokens.length) {
          const nextToken = tokens[next]

          if (nextToken.type === 'inline' || nextToken.hidden) {
          // Block-level tag containing an inline tag.
          //
            needLf = false
          } else if (nextToken.nesting === -1 && nextToken.tag === token.tag) {
          // Opening tag + closing tag of the same type. E.g. `<li></li>`.
          //
            needLf = false
          }
        }
      }
    }

    result += needLf ? '>\n' : '>'

    return result
  }

  /**
   * The same as {@link Renderer.render}, but for single token of `inline` type.
   */
  renderInline (tokens: Token[], options: Required<MarkdownItOptions>, env: Env | undefined): string {
    let result = ''
    const rules = this.rules

    for (let i = 0, len = tokens.length; i < len; i++) {
      const type = tokens[i].type

      if (typeof rules[type] !== 'undefined') {
        result += rules[type](tokens, i, options, env, this)
      } else {
        result += this.renderToken(tokens, i, options)
      }
    }

    return result
  }

  /**
   * Special kludge for image `alt` attributes to conform CommonMark spec.
   * Don't try to use it! Spec requires to show `alt` content with stripped markup,
   * instead of simple escaping.
   */
  renderInlineAsText (tokens: Token[], options: Required<MarkdownItOptions>, env: Env | undefined): string {
    let result = ''

    for (let i = 0, len = tokens.length; i < len; i++) {
      switch (tokens[i].type) {
        case 'text':
        case 'code_inline':
          // code content is added as plain text, without backticks
          result += tokens[i].content
          break
        case 'image':
          result += this.renderInlineAsText(tokens[i].children!, options, env)
          break
        case 'html_inline':
        case 'html_block':
          result += tokens[i].content
          break
        case 'softbreak':
        case 'hardbreak':
          result += '\n'
          break
        default:
        // all other tokens are skipped
      }
    }

    return result
  }

  /**
   * Takes token stream and generates HTML. Probably, you will never need to call
   * this method directly.
   */
  render (tokens: Token[], options: Required<MarkdownItOptions>, env?: Env): string {
    let result = ''
    const rules = this.rules

    for (let i = 0, len = tokens.length; i < len; i++) {
      const type = tokens[i].type

      if (type === 'inline') {
        result += this.renderInline(tokens[i].children!, options, env)
      } else if (typeof rules[type] !== 'undefined') {
        result += rules[type](tokens, i, options, env, this)
      } else {
        result += this.renderToken(tokens, i, options)
      }
    }

    return result
  }
}

export default Renderer
