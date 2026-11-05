export function confirmDocumentClose (doc: Document): Promise<'download' | 'discard' | 'continue'> {
  return new Promise(resolve => {
    const prompt = doc.createElement('dialog')
    prompt.setAttribute('data-document-unsaved', '')
    prompt.setAttribute('aria-label', '文档已修改，是否下载副本？')
    const title = doc.createElement('h2')
    title.textContent = '文档有尚未下载的修改'
    const message = doc.createElement('p')
    message.textContent = '是否下载修改后的副本？原服务器上的文件不会改变。'
    prompt.append(title, message)
    let choice: 'download' | 'discard' | 'continue' = 'continue'
    for (const [value, label] of [['download', '下载副本并关闭'], ['discard', '不下载，关闭'], ['continue', '继续编辑']] as const) {
      const button = doc.createElement('button')
      button.type = 'button'
      button.textContent = label
      button.setAttribute('data-document-choice', value)
      button.addEventListener('click', () => { choice = value; prompt.close() })
      prompt.append(button)
    }
    prompt.addEventListener('close', () => { prompt.remove(); resolve(choice) }, { once: true })
    prompt.addEventListener('cancel', event => { event.preventDefault(); prompt.close() })
    doc.body.append(prompt)
    try { prompt.showModal(); prompt.querySelector<HTMLButtonElement>('[data-document-choice="continue"]')?.focus() } catch { prompt.remove(); resolve('continue') }
  })
}
