import { modelWebUrl } from './neural_model.ts'

const textFormats = ['txt', 'md', 'csv', 'tsv', 'json', 'yaml', 'yml', 'xml', 'log']
const officeFormats = ['doc', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'odt']
const aliases: Record<string, string> = { xlxs: 'xlsx', powerpoint: 'pptx', ppsx: 'pptx' }

export function documentFormat (source: string): string | null {
  const url = modelWebUrl(source, 'https://markdown.local/')
  if (!url) { return null }
  const extension = url.pathname.split('.').pop()?.toLowerCase() || ''
  if (Object.prototype.hasOwnProperty.call(aliases, extension)) { return aliases[extension] }
  return ['docx', 'pdf', ...textFormats, ...officeFormats].includes(extension) ? extension : null
}

export function isTextDocument (format: string): boolean { return textFormats.includes(format) }

export function documentCopyName (source: string, format: string): string {
  let name = 'document.' + format
  try { name = decodeURIComponent(new URL(source).pathname.split('/').pop() || name) } catch { /* Use a safe fallback. */ }
  name = name.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_')
  name = name.replace(/\.xlxs$/i, '.xlsx').replace(/\.powerpoint$/i, '.pptx')
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) + '-副本' + name.slice(dot) : name + '-副本.' + format
}

export function documentMimeType (format: string): string {
  const types: Record<string, string> = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    pdf: 'application/pdf'
  }
  return types[format] || 'text/plain;charset=utf-8'
}

export function officePreviewUrl (source: string): string | null {
  const url = modelWebUrl(source)
  if (!url || url.protocol !== 'https:') { return null }
  return 'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(url.href)
}
