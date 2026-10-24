import { modelWebUrl } from './common/neural_model.ts'
import { documentFormat, documentCopyName, documentMimeType, isTextDocument, officePreviewUrl } from './common/document_file.ts'
import { openTextDocument, readDocumentResponse } from './document_session.ts'
import type { DocumentSession } from './document_session.ts'
import { openPreview } from './preview_controls.ts'
import { confirmDocumentClose } from './document_prompt.ts'
import { controlButtonStyle } from './control_styles.ts'
import { openXlsxDocument, openPptxDocument, columnLabel } from './office_sessions.ts'
import { openPdfDocument } from './pdf_session.ts'
import { openWordDocument } from './word_editor.ts'
import type { WordEngineFactory } from './word_editor.ts'

export function openDocument (link: HTMLAnchorElement, adapters: { word?: WordEngineFactory } = {}): boolean {
  const doc = link.ownerDocument
  const source = modelWebUrl(link.getAttribute('href') || '', doc.baseURI)
  const format = source && documentFormat(source.href)
  if (!source || !format) { return false }
  const controller = new AbortController()
  const container = doc.createElement('span')
  container.hidden = true
  container.setAttribute('data-preview-container', '')
  container.dataset.previewTitle = link.textContent?.trim() || source.pathname.split('/').pop() || '文档'
  const pane = doc.createElement('div')
  pane.setAttribute('data-preview-content', '')
  pane.setAttribute('data-document-pane', '')
  pane.dataset.documentFormat = format
  container.append(pane)
  const toolbar = doc.createElement('div')
  toolbar.setAttribute('data-document-toolbar', '')
  const badge = doc.createElement('span')
  badge.setAttribute('data-document-dirty', '')
  const status = doc.createElement('p')
  status.setAttribute('data-document-status', '')
  status.setAttribute('role', 'status')
  const body = doc.createElement('div')
  body.setAttribute('data-document-body', '')
  let session: DocumentSession | null = null
  let closed = false
  let busy = false
  let pendingWork: Promise<boolean> | null = null
  let pdfFrame: HTMLIFrameElement | null = null
  let previewUrl: string | null = null
  let refresh: HTMLButtonElement | null = null
  const updateBadge = (): void => { badge.textContent = session?.dirty() ? '有未下载的修改' : '修改不会写回原文件' }
  function button (label: string, action: () => void): HTMLButtonElement {
    const button = doc.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.style.cssText = controlButtonStyle
    button.addEventListener('click', action)
    toolbar.append(button)
    return button
  }
  const copyLink = button('复制链接', () => {
    const copy = async (): Promise<void> => {
      try {
        const clipboard = doc.defaultView?.navigator.clipboard
        if (!clipboard) { throw new Error('Clipboard unavailable') }
        await clipboard.writeText(source.href)
        if (!closed) { status.textContent = '链接已复制。' }
      } catch {
        if (closed) { return }
        const input = doc.createElement('input')
        input.readOnly = true
        input.value = source.href
        input.setAttribute('aria-label', '手动复制文档链接')
        status.textContent = '无法自动复制，请选中下面的链接手动复制。'
        status.append(input)
        input.focus(); input.select()
      }
    }
    void copy()
  })
  const open = doc.createElement('a')
  open.href = source.href
  open.target = '_blank'
  open.rel = 'noopener noreferrer'
  open.textContent = '在另一个页面打开 ↗'
  open.style.cssText = controlButtonStyle + 'text-decoration:none;'
  const editLabel = format === 'xlsx' ? '编辑单元格' : format === 'pptx' ? '编辑文字' : format === 'pdf' ? '编辑批注' : format === 'docx' ? '编辑文档' : '编辑正文'
  const edit = button(editLabel, () => {
    const enabled = pane.dataset.documentEditing !== 'true'
    pane.dataset.documentEditing = String(enabled)
    session?.setEditing?.(enabled)
    edit.setAttribute('aria-pressed', String(enabled))
    edit.textContent = enabled ? format === 'docx' ? '只读预览' : '预览内容' : editLabel
  })
  edit.setAttribute('aria-pressed', 'false')
  edit.disabled = true
  const setBusy = (value: boolean): void => {
    busy = value
    edit.disabled = value || !session?.editable
    save.disabled = value || !session
    if (refresh) { refresh.disabled = value || !session }
    session?.setBusy?.(value)
    pane.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-document-input]').forEach(input => { input.disabled = value })
  }
  const exportDocument = (downloadCopy: boolean): Promise<boolean> => {
    if (pendingWork) { return pendingWork }
    const active = session
    if (!active) { return Promise.resolve(false) }
    setBusy(true)
    status.textContent = downloadCopy ? '正在生成副本…' : '正在更新预览…'
    pendingWork = Promise.resolve().then(async () => {
      try {
        if (downloadCopy && active.downloadCopy) {
          await active.downloadCopy(documentCopyName(source.href, format))
          if (closed) { return false }
          active.markDownloaded(); updateBadge(); status.textContent = '已开始下载修改后的副本。'
          return true
        }
        const bytes = await active.exportBytes()
        if (closed) { return false }
        const buffer = new Uint8Array(bytes.length)
        buffer.set(bytes)
        const blob = new Blob([buffer.buffer], { type: documentMimeType(format) })
        const url = URL.createObjectURL(blob)
        if (!downloadCopy && pdfFrame) {
          if (previewUrl) { URL.revokeObjectURL(previewUrl) }
          previewUrl = url
          pdfFrame.src = url
          status.textContent = '已更新 PDF 预览；批注的显示方式取决于阅读器。修改仍需下载副本。'
          return true
        }
        const anchor = doc.createElement('a')
        anchor.href = url
        anchor.download = documentCopyName(source.href, format)
        doc.body.append(anchor)
        anchor.click(); anchor.remove()
        doc.defaultView?.setTimeout(() => URL.revokeObjectURL(url), 60000)
        active.markDownloaded()
        updateBadge()
        status.textContent = '已开始下载修改后的副本。'
        return true
      } catch {
        status.textContent = '副本生成失败，修改仍保留在弹窗中，请继续编辑或重试。'
        return false
      }
    }).finally(() => { pendingWork = null; setBusy(false) })
    return pendingWork
  }
  const save = button('下载副本', () => { void exportDocument(true) })
  save.disabled = true
  if (format === 'pdf') {
    refresh = button('更新 PDF 预览', () => { void exportDocument(false) })
    refresh.disabled = true
  }
  toolbar.append(badge)
  pane.append(toolbar, status, body)
  const beforeUnload = (event: BeforeUnloadEvent): void => {
    if (session?.dirty()) { event.preventDefault(); event.returnValue = '' }
  }
  doc.body.append(container)
  const opened = openPreview(link, {
    container,
    headerActions: [copyLink, open],
    async beforeClose () {
      if (pendingWork) { await pendingWork }
      if (!session?.dirty()) { return true }
      setBusy(true)
      try {
        const choice = await confirmDocumentClose(doc)
        return choice === 'discard' || (choice === 'download' && await exportDocument(true))
      } finally { if (!pendingWork) { setBusy(false) } }
    },
    onClose () {
      closed = true
      controller.abort()
      session?.dispose?.()
      if (previewUrl) { URL.revokeObjectURL(previewUrl) }
      container.remove()
      doc.defaultView?.removeEventListener('beforeunload', beforeUnload)
    }
  })
  if (!opened) { controller.abort(); container.remove(); return false }
  doc.defaultView?.addEventListener('beforeunload', beforeUnload)
  updateBadge()
  const renderSession = (loaded: DocumentSession): void => {
    session = loaded
    edit.disabled = !loaded.editable
    save.disabled = false
    if (refresh) { refresh.disabled = false }
    status.textContent = loaded.note
    if (loaded.setEditing && loaded.editable) {
      pane.dataset.documentEditing = 'true'; loaded.setEditing(true)
      edit.textContent = '只读预览'; edit.setAttribute('aria-pressed', 'true')
    }
    const appendField = (field: DocumentSession['fields'][number], index: number, parent: HTMLElement): void => {
      const row = doc.createElement('div')
      row.setAttribute('data-document-field', '')
      const empty = format === 'pdf' ? '（此页暂无批注）' : format === 'xlsx' ? '' : '（空段落）'
      const preview = doc.createElement(isTextDocument(format) ? 'pre' : 'p')
      preview.setAttribute('data-document-text', '')
      preview.textContent = field.value || empty
      const multiline = isTextDocument(format) || field.multiline
      const input = doc.createElement(multiline ? 'textarea' : 'input')
      input.setAttribute('data-document-input', '')
      if (!multiline) { input.setAttribute('type', 'text') }
      input.readOnly = !loaded.editable || Boolean(field.readOnly)
      input.setAttribute('aria-label', field.label)
      input.value = field.value
      input.addEventListener('input', () => {
        if (busy) { input.value = field.value; return }
        try {
          loaded.update(index, input.value)
          preview.textContent = input.value || empty
          updateBadge()
        } catch (error) {
          input.value = field.value
          status.textContent = error instanceof Error ? error.message : '无法修改该段落。'
        }
      })
      row.append(preview, input)
      parent.append(row)
    }
    if (format === 'xlsx' || format === 'pptx' || format === 'pdf') {
      const groups = new Map<string, Array<{ field: DocumentSession['fields'][number], index: number }>>()
      loaded.fields.forEach((field, index) => {
        const key = field.group || '内容'
        if (!groups.has(key)) { groups.set(key, []) }
        groups.get(key)!.push({ field, index })
      })
      for (const [name, fields] of groups) {
        const section = doc.createElement('section')
        section.setAttribute('data-document-group', '')
        const heading = doc.createElement('h3'); heading.textContent = name; section.append(heading)
        if (format === 'xlsx') {
          const rows = Array.from(new Set(fields.map(({ field }) => field.row!))).sort((a, b) => a - b)
          const columns = Array.from(new Set(fields.map(({ field }) => field.column!))).sort((a, b) => a - b)
          if (rows.length * columns.length <= 10000) {
            const table = doc.createElement('table')
            const head = doc.createElement('tr')
            head.append(doc.createElement('th'))
            for (const column of columns) { const cell = doc.createElement('th'); cell.textContent = columnLabel(column); head.append(cell) }
            table.append(head)
            const byAddress = new Map(fields.map(item => [item.field.row + ':' + item.field.column, item]))
            for (const number of rows) {
              const row = doc.createElement('tr')
              const label = doc.createElement('th'); label.textContent = String(number); row.append(label)
              for (const column of columns) {
                const cell = doc.createElement('td')
                const item = byAddress.get(number + ':' + column)
                if (item) { appendField(item.field, item.index, cell) }
                row.append(cell)
              }
              table.append(row)
            }
            section.append(table)
          } else {
            const note = doc.createElement('p'); note.textContent = '稀疏工作表按单元格地址列出。'; section.append(note)
            for (const { field, index } of fields) { const label = doc.createElement('p'); label.textContent = field.label; section.append(label); appendField(field, index, section) }
          }
        } else { for (const { field, index } of fields) { appendField(field, index, section) } }
        body.append(section)
      }
    } else { loaded.fields.forEach((field, index) => appendField(field, index, body)) }
  }
  if (['docx', 'xlsx', 'pptx', 'pdf'].includes(format) || isTextDocument(format)) {
    if (format === 'pdf') {
      pdfFrame = doc.createElement('iframe')
      pdfFrame.setAttribute('data-document-pdf-preview', '')
      pdfFrame.title = container.dataset.previewTitle
      pdfFrame.referrerPolicy = 'no-referrer'
      pdfFrame.setAttribute('sandbox', 'allow-scripts allow-downloads')
      pdfFrame.src = source.href
      body.append(pdfFrame)
    }
    status.textContent = '正在加载文档…'
    const load = async (): Promise<void> => {
      try {
        const response = await fetch(source.href, { signal: controller.signal, credentials: 'same-origin' })
        const bytes = await readDocumentResponse(response, (isTextDocument(format) ? 2 : 20) * 1024 * 1024)
        if (closed) { return }
        const loaded = format === 'docx' ? await openWordDocument(bytes, body, updateBadge, controller.signal, adapters.word) : format === 'xlsx' ? openXlsxDocument(bytes) :
          format === 'pptx' ? openPptxDocument(bytes) : format === 'pdf' ? await openPdfDocument(bytes) : openTextDocument(bytes)
        if (!closed) { renderSession(loaded) }
      } catch (error) {
        if (!closed) { status.textContent = '无法加载文档，请检查文件地址、登录权限及 CORS；也可在另一个页面打开。' + (error instanceof Error ? ' ' + error.message : '') }
      }
    }
    void load()
  } else {
    edit.hidden = true
    save.hidden = true
    const frame = doc.createElement('iframe')
    frame.title = container.dataset.previewTitle
    frame.referrerPolicy = 'no-referrer'
    frame.setAttribute('sandbox', 'allow-scripts allow-downloads')
    status.textContent = '此格式在这里仅支持只读在线预览；在线服务需要可公开访问的 HTTPS 文件地址，并会收到该地址。'
    const url = officePreviewUrl(source.href)
    const office = button('使用 Office 在线预览（公开文件）', () => {
      if (!url) { return }
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-downloads')
      frame.src = url
      body.append(frame)
      office.disabled = true
    })
    office.disabled = !url
  }
  return true
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) { return }
    const link = event.target.closest<HTMLAnchorElement>('a[data-document-link]')
    if (!link || link.getAttribute('download') !== null) { return }
    if (openDocument(link)) { event.preventDefault() }
  })
}

export {}
