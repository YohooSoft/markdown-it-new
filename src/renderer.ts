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
default_rules.math_inline = function (tokens: Token[], idx: number): string {
  return '<span class="math-inline">\\(' + escapeHtml(tokens[idx].content) + '\\)</span>'
}
default_rules.math_block = function (tokens: Token[], idx: number): string {
  return '<div class="math-block">\\[' + escapeHtml(tokens[idx].content) + '\\]</div>\n'
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

function codeLanguageLabel (language: string): string {
  const short = language.split('.').pop()?.toLowerCase() ?? ''
  const labels: Record<string, string> = {
    bash: 'Shell',
    css: 'CSS',
    html: 'HTML',
    java: 'Java',
    js: 'JavaScript',
    json: 'JSON',
    md: 'Markdown',
    py: 'Python',
    python: 'Python',
    sh: 'Shell',
    sql: 'SQL',
    ts: 'TypeScript',
    tsx: 'TSX',
    txt: '纯文本',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML'
  }
  return labels[short] ?? (language || '纯文本')
}

function renderCodeBlock (token: Token, highlighted: string, language: string): string {
  const label = escapeHtml(codeLanguageLabel(language))
  const firstLine = escapeHtml((token.content.split(/\r?\n/)[0] || '').slice(0, 96))
  const codeClass = language ? ' class="' + escapeHtml('language-' + language) + '"' : ''
  const lines = highlighted.replace(/\r\n/g, '\n').split('\n')
  const codeHtml = lines.map((line, index) => (
    '<span class="code-line" data-code-line style="display:block">' +
    '<span data-code-line-number hidden style="display:inline-block;min-width:2.4em;margin-right:1em;color:#94a3b8;text-align:right;user-select:none">' +
    String(index + 1) +
    '</span><span data-code-line-content>' + (line || ' ') + '</span></span>'
  )).join('\n')
  const codeIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"/></svg>'
  const copyIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></svg>'
  const buttonStyle = 'display:inline-flex;align-items:center;gap:5px;padding:7px 10px;border:1px solid rgba(148,163,184,.35);border-radius:8px;background:rgba(255,255,255,.78);color:#334155;font:500 13px/1.3 system-ui,sans-serif;cursor:pointer;'

  return '<div class="code-block" data-code-block data-code-language="' + escapeHtml(language) + '" style="margin:12px 0;border:1px solid #cbd5e1;border-radius:12px;overflow:visible;background:#fff;box-shadow:0 4px 16px rgba(15,23,42,.06)">' +
    '<div data-code-toolbar style="display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:54px;padding:10px 14px;background:#f8fafc;border-bottom:1px solid #cbd5e1;font:500 14px/1.3 system-ui,sans-serif">' +
    '<div style="display:flex;align-items:center;gap:9px;color:#2563eb">' + codeIcon + '<strong>' + label + '</strong></div>' +
    '<div style="display:flex;align-items:center;gap:7px;min-width:0">' +
    '<button type="button" data-code-mode-toggle style="' + buttonStyle + '">Embed <span aria-hidden="true">⌄</span></button>' +
    '<code data-code-preview title="代码预览" style="display:block;max-width:260px;overflow:hidden;color:#334155;text-overflow:ellipsis;white-space:nowrap">' + firstLine + '</code>' +
    '<button type="button" data-code-copy aria-label="复制代码" title="复制代码" style="' + buttonStyle + '">' + copyIcon + '</button>' +
    '<button type="button" data-code-settings aria-expanded="false" style="' + buttonStyle + '">设置</button>' +
    '</div></div>' +
    '<div data-code-mode-menu hidden style="position:relative;z-index:5;margin:0 10px;padding:12px;border:1px solid #cbd5e1;border-radius:0 0 10px 10px;background:#fff;box-shadow:0 8px 22px rgba(15,23,42,.12);font:500 14px/1.4 system-ui,sans-serif">' +
    '<strong style="display:block;margin-bottom:10px;color:#1f2937;font-size:16px">Select an option</strong>' +
    '<button type="button" data-code-mode="embed" aria-selected="true" style="display:grid;width:100%;gap:3px;padding:8px;border:0;border-radius:8px;background:#f8fafc;color:#1f2937;text-align:left;cursor:pointer">' +
    '<span style="font-size:15px">✓ &nbsp;Embed</span><span style="padding-left:24px;color:#64748b">Embed this code in your website.</span></button>' +
    '<button type="button" data-code-mode="raw" aria-selected="false" style="display:grid;width:100%;gap:3px;padding:8px;border:0;border-radius:8px;background:transparent;color:#1f2937;text-align:left;cursor:pointer">' +
    '<span style="font-size:15px">&nbsp;&nbsp;&nbsp;Raw</span><span style="padding-left:24px;color:#64748b">Show the raw code content.</span></button></div>' +
    '<div data-code-settings-menu hidden style="position:relative;z-index:4;display:grid;gap:9px;margin:0 10px;padding:12px;border:1px solid #cbd5e1;border-radius:0 0 10px 10px;background:#fff;box-shadow:0 8px 22px rgba(15,23,42,.12);font:500 13px/1.4 system-ui,sans-serif;color:#334155">' +
    '<label style="display:flex;align-items:center;justify-content:space-between;gap:14px">代码风格<select data-code-style style="min-width:150px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#334155"><option value="github">GitHub</option><option value="github-dark">GitHub Dark</option><option value="monokai">Monokai</option><option value="dracula">Dracula</option><option value="solarized-light">Solarized Light</option></select></label>' +
    '<label style="display:flex;align-items:center;justify-content:space-between;gap:14px">背景颜色<select data-code-background style="min-width:110px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#334155"><option value="light">浅色</option><option value="dark">深色</option></select></label>' +
    '<label style="display:flex;align-items:center;gap:7px"><input type="checkbox" data-code-wrap style="accent-color:#2563eb">自动换行</label>' +
    '<label style="display:flex;align-items:center;gap:7px"><input type="checkbox" data-code-line-numbers style="accent-color:#2563eb">行序号</label>' +
    '<button type="button" data-code-stream style="padding:7px 10px;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;color:#334155;font:500 13px/1.3 system-ui,sans-serif;cursor:pointer">流式动画</button></div>' +
    '<pre data-code-pre style="margin:0;padding:16px;overflow:auto;background:#fff;color:#1f2937"><code data-code-code' + codeClass + ' style="display:block;white-space:pre;font:500 14px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace">' + codeHtml + '</code></pre>' +
    '</div>\n'
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

  if (options.codeControls) {
    return renderCodeBlock(token, highlighted, langName)
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
default_rules.image_html_inline = function (tokens: Token[], idx: number): string {
  return tokens[idx].content
}
default_rules.image_html_block = function (tokens: Token[], idx: number): string {
  return `${tokens[idx].content}\n`
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
    `<button type="button" data-table-mode-button="sort" aria-pressed="false" title="在列头显示排序控件" style="${buttonStyle}">排序</button>` +
    `<button type="button" data-table-mode-button="filter" aria-pressed="false" title="在列头显示筛选控件" style="${buttonStyle}">筛选</button>` +
    `<button type="button" data-table-reset title="恢复原始顺序并清空筛选" style="${buttonStyle}">还原</button>` +
    '</div></div>' +
    '</div>\n'
}
default_rules.table_column_controls = function (tokens: Token[], idx: number): string {
  const meta = tokens[idx].meta ?? {}
  const column = Number(meta.column ?? 0)
  const header = escapeHtml(String(meta.header ?? '').trim() || `第 ${column + 1} 列`)
  const iconButtonStyle = 'display:inline-flex;align-items:center;justify-content:center;width:25px;height:25px;' +
    'padding:0;border:1px solid rgba(148,163,184,.34);border-radius:7px;' +
    'background:rgba(255,255,255,.72);color:#64748b;cursor:pointer;vertical-align:middle;'
  const sortIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4v16M5 7l3-3 3 3M16 20V4M13 17l3 3 3-3"/></svg>'
  const filterIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16l-6.5 7.2V18l-3 1v-6.8L4 5z"/></svg>'
  const actionStyle = 'border:0;background:transparent;padding:2px 0;color:#334155;' +
    'font:500 13px/1.4 system-ui,sans-serif;cursor:pointer;white-space:nowrap;'
  const filterCheckboxStyle = 'width:17px;height:17px;margin:0;accent-color:#39b58d;cursor:pointer;'

  return '<span class="table-column-controls" data-table-column-controls style="position:relative;display:inline-flex;align-items:center;gap:4px;margin-left:7px;vertical-align:middle">' +
    `<button type="button" data-table-sort-button data-table-column="${column}" data-table-sort-direction="none" aria-label="排序 ${header}" title="排序 ${header}" hidden style="${iconButtonStyle}">${sortIcon}</button>` +
    `<button type="button" data-table-filter-button data-table-column="${column}" aria-label="筛选 ${header}" title="筛选 ${header}" hidden style="${iconButtonStyle}">${filterIcon}</button>` +
    `<span data-table-filter-popover hidden style="position:absolute;z-index:20;top:calc(100% + 5px);left:0;min-width:240px;max-width:320px;padding:10px;border:1px solid rgba(148,163,184,.32);border-radius:10px;background:rgba(255,255,255,.97);box-shadow:0 8px 24px rgba(15,23,42,.14);color:#334155;text-align:left">` +
    '<div style="display:flex;align-items:center;gap:10px;padding-bottom:8px;border-bottom:1px solid rgba(148,163,184,.22);white-space:nowrap">' +
    `<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-table-select-all checked style="${filterCheckboxStyle}"><span>全选</span><span data-table-filter-count style="color:#64748b">（0）</span></label>` +
    `<button type="button" data-table-filter-invert style="${actionStyle}">反选</button>` +
    `<button type="button" data-table-filter-duplicates style="${actionStyle}">重复项</button>` +
    `<button type="button" data-table-filter-top style="${actionStyle}">前十项</button>` +
    `<button type="button" data-table-filter-more hidden style="${actionStyle}">更多</button>` +
    '</div>' +
    '<div data-table-filter-values style="display:grid;gap:5px;max-height:260px;overflow:auto;padding-top:8px"></div>' +
    '</span>' +
    '</span>'
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
