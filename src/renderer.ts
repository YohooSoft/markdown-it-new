import { unescapeAll, escapeHtml } from './common/utils.ts'
import { controlButtonStyle, controlSelectStyle, controlToolbarStyle, controlPopoverStyle } from './control_styles.ts'
import { neuralModelFormat, neuralViewerUrl } from './common/neural_model.ts'
import { previewOpen, previewClose, previewRanges } from './preview_renderer.ts'
import { documentFormat } from './common/document_file.ts'
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

default_rules.link_open = function (tokens, idx, options, env, slf): string {
  const token = tokens[idx]
  const href = token.attrGet('href')
  const format = options.documentLinks && typeof href === 'string' ? documentFormat(href) : null
  if (!format) { return slf.renderToken(tokens, idx, options) }
  const attrs = (token.attrs || []).filter(([name]) => !['data-document-link', 'aria-haspopup', 'aria-expanded'].includes(name))
  attrs.push(['data-document-link', format], ['aria-haspopup', 'dialog'], ['aria-expanded', 'false'])
  return '<a' + slf.renderAttrs({ attrs }) + '>'
}

type ModelFormat = 'glb' | 'gltf'

function modelFormat (source: string): ModelFormat | null {
  try {
    const pathname = new URL(source, 'https://markdown.local/').pathname.toLowerCase()
    if (pathname.endsWith('.glb')) { return 'glb' }
    if (pathname.endsWith('.gltf')) { return 'gltf' }
  } catch {
    // Invalid sources fall back to ordinary image rendering.
  }
  return null
}

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
  const buttonStyle = controlButtonStyle

  return '<div class="code-block" data-code-block data-code-language="' + escapeHtml(language) + '" style="margin:20px 0;border:1px solid #dedee3;border-radius:14px;overflow:visible;background:#fff;box-shadow:0 8px 28px rgba(0,0,0,.06),0 1px 3px rgba(0,0,0,.04)">' +
    '<div data-code-toolbar style="display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:58px;padding:12px 16px;border-radius:13px 13px 0 0;background:linear-gradient(180deg,#fafafa,#eeeef1);border-bottom:1px solid #dedee3;font:500 13px/1.5 system-ui,sans-serif">' +
    '<div style="display:flex;align-items:center;gap:12px;color:#515158">' +
    '<span data-code-window-dots aria-hidden="true" style="display:inline-flex;gap:7px;padding-right:4px">' +
    '<span style="width:11px;height:11px;border-radius:50%;background:#ff5f57;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)"></span>' +
    '<span style="width:11px;height:11px;border-radius:50%;background:#febc2e;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)"></span>' +
    '<span style="width:11px;height:11px;border-radius:50%;background:#28c840;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)"></span></span>' +
    codeIcon + '<strong style="font-weight:600">' + label + '</strong></div>' +
    '<div data-code-actions style="display:flex;align-items:center;gap:7px;min-width:0">' +
    '<button type="button" data-code-mode-toggle aria-expanded="false" aria-label="代码显示模式" style="' + buttonStyle + '">Embed <span aria-hidden="true">⌄</span></button>' +
    '<code data-code-preview title="代码预览" style="display:block;max-width:180px;min-width:0;overflow:hidden;color:#94a3b8;font:12px/1.5 ui-monospace,Consolas,monospace;text-overflow:ellipsis;white-space:nowrap">' + firstLine + '</code>' +
    '<button type="button" data-code-copy aria-label="复制代码" title="复制代码" style="' + buttonStyle + '">' + copyIcon + '</button>' +
    '<button type="button" data-code-settings aria-expanded="false" style="' + buttonStyle + '">设置</button>' +
    '</div></div>' +
    '<div data-code-mode-menu hidden style="' + controlPopoverStyle + '">' +
    '<strong style="display:block;margin-bottom:10px;color:#1f2937;font-size:16px">显示方式</strong>' +
    '<button type="button" data-code-mode="embed" aria-selected="true" style="display:grid;width:100%;gap:3px;padding:8px;border:0;border-radius:8px;background:#f8fafc;color:#1f2937;text-align:left;cursor:pointer">' +
    '<span style="font-size:15px">✓ &nbsp;Embed</span><span style="padding-left:24px;color:#64748b">嵌入式代码视图</span></button>' +
    '<button type="button" data-code-mode="raw" aria-selected="false" style="display:grid;width:100%;gap:3px;padding:8px;border:0;border-radius:8px;background:transparent;color:#1f2937;text-align:left;cursor:pointer">' +
    '<span style="font-size:15px">&nbsp;&nbsp;&nbsp;Raw</span><span style="padding-left:24px;color:#64748b">原始代码视图</span></button></div>' +
    '<div data-code-settings-menu hidden style="' + controlPopoverStyle + '">' +
    '<label style="display:flex;align-items:center;justify-content:space-between;gap:14px">代码风格<select data-code-style style="' + controlSelectStyle + '"><option value="github">GitHub</option><option value="github-dark">GitHub Dark</option><option value="monokai">Monokai</option><option value="dracula">Dracula</option><option value="solarized-light">Solarized Light</option></select></label>' +
    '<label style="display:flex;align-items:center;justify-content:space-between;gap:14px">背景颜色<select data-code-background style="' + controlSelectStyle + '"><option value="light">浅色</option><option value="dark">深色</option></select></label>' +
    '<label style="display:flex;align-items:center;gap:7px"><input type="checkbox" data-code-wrap style="accent-color:#007aff">自动换行</label>' +
    '<label style="display:flex;align-items:center;gap:7px"><input type="checkbox" data-code-line-numbers style="accent-color:#007aff">行序号</label>' +
    '<button type="button" data-code-stream style="' + controlButtonStyle + '">流式动画</button></div>' +
    '<pre data-code-pre style="margin:0;padding:22px;overflow:auto;background:#fff;color:#24292f"><code data-code-code' + codeClass + ' style="display:block;white-space:pre;font:400 13px/1.8 ui-monospace,SFMono-Regular,Consolas,monospace">' + codeHtml + '</code></pre>' +
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

  const source = token.attrGet('src')
  if (options.neuralModels && !token.meta?.previewInLink && typeof source === 'string') {
    const format = neuralModelFormat(source)
    const viewer = neuralViewerUrl(source, options.neuralModelViewerUrl)
    if (format && viewer) {
      const name = String(token.attrGet('alt') || format.label + ' 模型')
      const title = token.attrGet('title')
      return '<span class="neural-model-viewer" data-neural-model data-neural-model-format="' + format.extension +
        '" data-neural-model-source="' + escapeHtml(source) +
        '" data-neural-model-viewer="' + escapeHtml(options.neuralModelViewerUrl) +
        '" data-neural-model-title="' + escapeHtml(name) + '"' +
        (title ? ' title="' + escapeHtml(String(title)) + '"' : '') +
        ' style="display:block;margin:20px 0;border:1px solid #dedee3;border-radius:14px;background:#fff;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,.06);font:13px/1.6 system-ui,sans-serif;color:#515158">' +
        '<span style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:linear-gradient(#fafafa,#eeeef1);border-bottom:1px solid #dedee3">' +
        '<span style="display:flex;align-items:center;gap:10px;min-width:0">' +
        '<span style="padding:3px 8px;border:1px solid #d4d4da;border-radius:6px;background:#fff;color:#007aff;font-size:11px;font-weight:600">' + escapeHtml(format.label) + '</span>' +
        '<strong style="font-weight:600;overflow-wrap:anywhere">' + escapeHtml(name) + '</strong></span>' +
        '<span style="display:flex;flex-wrap:wrap;gap:8px">' +
        '<button type="button" data-neural-model-toggle aria-expanded="false" style="' + controlButtonStyle + '">查看模型</button>' +
        '<a data-neural-model-open href="' + escapeHtml(viewer) + '" target="_blank" rel="noopener noreferrer" style="' + controlButtonStyle + 'text-decoration:none">在 Netron 中打开 ↗</a></span></span>' +
        '<span data-neural-model-slot hidden></span>' +
        '<span data-neural-model-status role="status" style="display:block;padding:12px 16px;color:#73737c;font-size:12px">' +
        '点击预览会在 Netron 中加载模型地址；跨域文件需允许 CORS。仅权重文件可能没有计算图。' +
        ' <a href="' + escapeHtml(source) + '" target="_blank" rel="noopener noreferrer" style="color:#007aff">模型文件 ↗</a></span></span>'
    }
  }
  if (options.model3d && typeof source === 'string') {
    const format = modelFormat(source)
    if (format) {
      const alt = token.attrGet('alt')
      const title = token.attrGet('title')
      return '<model-viewer class="markdown-model-viewer" data-model-format="' + format +
        '" src="' + escapeHtml(source) + '" alt="' + escapeHtml(typeof alt === 'string' ? alt : '') + '"' +
        (typeof title === 'string' ? ' title="' + escapeHtml(title) + '"' : '') +
        ' camera-controls auto-rotate ar shadow-intensity="1" loading="lazy"' +
        ' style="display:block;width:100%;height:min(70vh,520px);min-height:320px;margin:12px 0;border:1px solid rgba(148,163,184,.35);border-radius:12px;background:linear-gradient(145deg,#f8fafc,#e2e8f0);overflow:hidden"></model-viewer>'
    }
  }

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
  const selectStyle = controlSelectStyle

  return '<div class="task-list-menu" data-task-list-menu role="toolbar" aria-label="待办事项菜单" ' +
    'style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;' +
    controlToolbarStyle + '">' +
    '<div style="display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 10px">' +
    '<strong style="color:#334155;font-size:13px;font-weight:650">待办事项</strong>' +
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
  const buttonStyle = controlButtonStyle

  return '<div class="table-controls-menu" data-table-controls-menu role="toolbar" aria-label="表格筛选和排序" ' +
    'style="display:grid;' + controlToolbarStyle + '">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">' +
    '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">' +
    '<strong style="color:#334155;font-size:13px;font-weight:650">表格筛选与排序</strong>' +
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
  const iconButtonStyle = 'display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;' +
    'padding:0;border:1px solid rgba(148,163,184,.34);border-radius:7px;' +
    'background:rgba(255,255,255,.72);color:#64748b;cursor:pointer;vertical-align:middle;'
  const sortIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4v16M5 7l3-3 3 3M16 20V4M13 17l3 3 3-3"/></svg>'
  const filterIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16l-6.5 7.2V18l-3 1v-6.8L4 5z"/></svg>'
  const actionStyle = 'border:0;background:transparent;padding:2px 0;color:#334155;' +
    'font:500 13px/1.4 system-ui,sans-serif;cursor:pointer;white-space:nowrap;'
  const filterCheckboxStyle = 'width:17px;height:17px;margin:0;accent-color:#007aff;cursor:pointer;'

  return '<span class="table-column-controls" data-table-column-controls style="position:relative;display:inline-flex;align-items:center;gap:4px;margin-left:7px;vertical-align:middle">' +
    `<button type="button" data-table-sort-button data-table-column="${column}" data-table-sort-direction="none" aria-label="排序 ${header}" title="排序 ${header}" hidden style="${iconButtonStyle}">${sortIcon}</button>` +
    `<button type="button" data-table-filter-button data-table-column="${column}" aria-label="筛选 ${header}" title="筛选 ${header}" hidden style="${iconButtonStyle}">${filterIcon}</button>` +
    `<span data-table-filter-popover hidden style="position:absolute;z-index:20;top:calc(100% + 5px);left:0;box-sizing:border-box;min-width:260px;max-width:340px;padding:14px;border:1px solid #dedee3;border-radius:12px;background:#fff;box-shadow:0 12px 36px rgba(30,41,59,.12);color:#334155;text-align:left">` +
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
      const preview = options.expandPreview && !tokens[i].meta?.previewInLink &&
        (type === 'image' || (type === 'image_html_inline' && tokens[i].content.startsWith('<img ')) ||
          (type === 'iframe_inline' && tokens[i].content.startsWith('<iframe ')))
      if (preview) { result += previewOpen(type === 'iframe_inline' ? '嵌入内容' : type === 'image' ? tokens[i].content || '图片或模型' : '图片', true) }

      if (typeof rules[type] !== 'undefined') {
        result += rules[type](tokens, i, options, env, this)
      } else {
        result += this.renderToken(tokens, i, options)
      }
      if (preview) { result += previewClose(true) }
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
    const ranges = options.expandPreview ? previewRanges(tokens) : null

    for (let i = 0, len = tokens.length; i < len; i++) {
      const type = tokens[i].type
      const title = ranges?.opens.get(i)
      if (title) { result += previewOpen(title) }
      const preview = options.expandPreview && (['fence', 'code_block', 'math_block'].includes(type) ||
        (type === 'iframe_block' && tokens[i].content.startsWith('<iframe ')) ||
        (type === 'image_html_block' && tokens[i].content.startsWith('<img ')))
      if (preview) { result += previewOpen(type === 'math_block' ? '公式' : type === 'iframe_block' ? '嵌入内容' : type === 'image_html_block' ? '图片' : '代码') }

      if (type === 'inline') {
        result += this.renderInline(tokens[i].children!, options, env)
      } else if (typeof rules[type] !== 'undefined') {
        result += rules[type](tokens, i, options, env, this)
      } else {
        result += this.renderToken(tokens, i, options)
      }
      if (preview || ranges?.closes.has(i)) { result += previewClose() }
    }

    return result
  }
}

export default Renderer
