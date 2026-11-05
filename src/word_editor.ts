import { openDocxDocument } from './document_session.ts'
import type { DocumentSession } from './document_session.ts'

export interface WordValue { data: unknown, options: Record<string, unknown> }
export interface WordStyle { bold?: boolean, italic?: boolean, underline?: boolean, font?: string, size?: number }
export interface WordEngine {
  supports?: (command: string) => boolean
  exportBytes?: () => Uint8Array
  value: () => WordValue
  run: (command: string, value?: string) => void
  mode: (readOnly: boolean) => void
  exportCopy: (name: string) => Promise<void>
  subscribe: (change: () => void, style: (value: WordStyle) => void) => () => void
  destroy: () => void
}
export type WordEngineFactory = (host: HTMLDivElement, bytes: ArrayBuffer, readOnly: boolean, signal?: AbortSignal) => Promise<WordEngine>

const defaultFactory: WordEngineFactory = async (...args) => {
  const { createDocxEngine } = await import('./docx_engine.ts')
  return createDocxEngine(...args)
}

export function wordSnapshot (value: WordValue): string {
  const { width, height, margins, paperDirection, header, footer, pageNumber, watermark } = value.options
  return JSON.stringify({ data: value.data, width, height, margins, paperDirection, header, footer, pageNumber, watermark })
}

/** Render a paginated editor, not a collection of paragraph inputs. */
export async function openWordDocument (
  bytes: Uint8Array, body: HTMLElement, onChange: () => void, signal: AbortSignal,
  factory: WordEngineFactory = defaultFactory
): Promise<DocumentSession> {
  const preflight = openDocxDocument(bytes)
  const doc = body.ownerDocument
  const shell = doc.createElement('section')
  shell.setAttribute('data-word-editor', '')
  const ribbon = doc.createElement('div')
  ribbon.setAttribute('data-word-ribbon', '')
  ribbon.setAttribute('role', 'toolbar')
  ribbon.setAttribute('aria-label', '文档格式工具栏')
  const host = doc.createElement('div')
  host.setAttribute('data-word-pages', '')
  const hint = doc.createElement('p')
  hint.setAttribute('data-word-hint', '')
  hint.textContent = '正在加载分页文档编辑器…'
  shell.append(ribbon, host, hint)
  body.append(shell)
  let engine: WordEngine | null = null
  let busy = false
  let editing = !preflight.locked
  let disposed = false
  let unsubscribe = (): void => {}
  const controls: Array<HTMLButtonElement | HTMLSelectElement | HTMLInputElement> = []
  const mark = (): void => { if (!disposed) { onChange() } }
  const run = (name: string, value?: string): void => { if (!busy && editing && engine) { try { engine.run(name, value); mark() } catch (error) { hint.textContent = error instanceof Error ? error.message : '当前操作暂不支持。' } } }
  const group = (title: string): HTMLDivElement => {
    const box = doc.createElement('div'); box.setAttribute('data-word-group', '')
    const label = doc.createElement('small'); label.textContent = title; box.append(label); ribbon.append(box)
    return box
  }
  const button = (parent: HTMLElement, label: string, title: string, command: string): HTMLButtonElement => {
    const button = doc.createElement('button'); button.type = 'button'; button.textContent = label
    button.setAttribute('aria-label', title); button.title = title; button.dataset.wordCommand = command
    button.addEventListener('mousedown', event => event.preventDefault())
    button.addEventListener('click', () => run(command)); parent.append(button); controls.push(button)
    return button
  }
  const select = (parent: HTMLElement, title: string, command: string, values: Array<[string, string]>): HTMLSelectElement => {
    const select = doc.createElement('select'); select.setAttribute('aria-label', title); select.dataset.wordCommand = command
    for (const [value, text] of values) { const option = doc.createElement('option'); option.value = value; option.textContent = text; select.append(option) }
    select.addEventListener('change', () => run(command, select.value)); parent.append(select); controls.push(select)
    return select
  }
  const history = group('编辑')
  button(history, '↶', '撤销', 'undo'); button(history, '↷', '重做', 'redo')
  const fonts = group('字体')
  const font = select(fonts, '字体', 'font', [['DengXian', '等线'], ['SimSun', '宋体'], ['Microsoft YaHei', '微软雅黑'], ['Arial', 'Arial'], ['Times New Roman', 'Times New Roman']])
  const pointSizes = [9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 36]
  const size = select(fonts, '字号（磅）', 'size', pointSizes.map(value => [String(value * 4 / 3), String(value)]))
  size.value = '16'
  const bold = button(fonts, 'B', '加粗', 'bold')
  const italic = button(fonts, 'I', '斜体', 'italic')
  const underline = button(fonts, 'U', '下划线', 'underline')
  for (const control of [bold, italic, underline]) { control.setAttribute('aria-pressed', 'false') }
  const color = doc.createElement('input'); color.dataset.wordCommand = 'color'; color.type = 'color'; color.value = '#000000'; color.setAttribute('aria-label', '文字颜色')
  color.addEventListener('input', () => run('color', color.value)); fonts.append(color); controls.push(color)
  const paragraph = group('段落')
  select(paragraph, '段落样式', 'heading', [['body', '正文'], ['h1', '标题 1'], ['h2', '标题 2'], ['h3', '标题 3']])
  button(paragraph, '左对齐', '左对齐', 'left'); button(paragraph, '居中', '居中', 'center'); button(paragraph, '右对齐', '右对齐', 'right')
  button(paragraph, '两端对齐', '两端对齐', 'justify')
  select(paragraph, '行距', 'spacing', [['1', '单倍'], ['1.5', '1.5 倍'], ['2', '双倍']])
  const insert = group('插入')
  button(insert, '分页符', '切换段前分页', 'pageBreak')
  const layout = group('页面布局')
  button(layout, '纵向', '纵向页面', 'portrait'); button(layout, '横向', '横向页面', 'landscape')
  select(layout, '页边距', 'margins', [['normal', '普通页边距'], ['narrow', '窄页边距']])
  const enabled = (): void => {
    for (const control of controls) { control.disabled = !engine || busy || !editing || engine.supports?.(control.dataset.wordCommand || '') === false }
    engine?.mode(!editing || busy)
  }
  enabled()
  const dispose = (): void => {
    if (disposed) { return }
    disposed = true
    unsubscribe(); engine?.destroy(); shell.remove()
    signal.removeEventListener('abort', dispose)
  }
  signal.addEventListener('abort', dispose, { once: true })
  try {
    if (signal.aborted) { throw new Error('文档加载已取消。') }
    const buffer = new Uint8Array(bytes.length); buffer.set(bytes)
    const loaded = await factory(host, buffer.buffer, Boolean(preflight.locked), signal)
    if (disposed || signal.aborted) { loaded.destroy(); throw new Error('文档加载已取消。') }
    engine = loaded
    const original = wordSnapshot(engine.value())
    let downloaded = original
    unsubscribe = engine.subscribe(mark, style => {
      bold.setAttribute('aria-pressed', String(Boolean(style.bold))); italic.setAttribute('aria-pressed', String(Boolean(style.italic))); underline.setAttribute('aria-pressed', String(Boolean(style.underline)))
      if (style.font) {
        if (!Array.from(font.children).some(option => (option as HTMLOptionElement).value === style.font)) {
          const option = doc.createElement('option'); option.value = style.font; option.textContent = style.font; font.append(option)
        }
        font.value = style.font
      }
      if (style.size) { size.value = String((pointSizes.find(point => Math.abs(point * 4 / 3 - style.size!) < 0.1) || style.size * 3 / 4) * 4 / 3) }
    })
    enabled()
    hint.textContent = preflight.locked ? '此文档带有保护或数字签名，只读显示。' : '自研 DOCX 第一阶段：可编辑普通段落，选中文字设置格式；未选择文字时格式应用于整段。Enter 新建段落，粘贴换行合并为空格。复杂对象只读并保留；分页按段落和表格排列，尚不等同于 Word。'
    return {
      fields: [], editable: !preflight.locked, locked: preflight.locked,
      note: '自研 DOCX 第一阶段：普通段落与选区格式编辑、分页纸张、表格基础显示、内嵌图片预览。复杂对象只读；保留原文件其他部件，只下载副本。',
      dirty: () => !disposed && wordSnapshot(engine!.value()) !== downloaded,
      update () { throw new Error('请直接在分页文档编辑器中修改。') },
      exportBytes () { if (engine!.exportBytes) { return engine!.exportBytes() }; if (wordSnapshot(engine!.value()) !== original) { throw new Error('请使用文档编辑器的下载副本操作。') } return bytes.slice() },
      async downloadCopy (name) {
        if (wordSnapshot(engine!.value()) === original) {
          const data = new Uint8Array(bytes.length); data.set(bytes)
          const url = URL.createObjectURL(new Blob([data.buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
          const link = doc.createElement('a'); link.href = url; link.download = name; doc.body.append(link); link.click(); link.remove()
          doc.defaultView?.setTimeout(() => URL.revokeObjectURL(url), 60000)
        } else { await engine!.exportCopy(name) }
      },
      markDownloaded () { downloaded = wordSnapshot(engine!.value()) },
      setEditing (value) { editing = value && !preflight.locked; enabled() },
      setBusy (value) { busy = value; enabled() },
      dispose
    }
  } catch (error) { dispose(); throw error }
}
