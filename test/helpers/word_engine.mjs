export function wordEngineStub (host, initialText = 'Original Word paragraph') {
  const state = { data: { main: [{ value: initialText }] }, options: { width: 794, height: 1123, margins: [96, 96, 96, 96], scale: 1, mode: 'edit' } }
  const exports = []
  let listener = () => {}
  let style = () => {}
  let destroyed = false
  const canvas = host.ownerDocument.createElement('canvas')
  host.append(canvas)
  const engine = {
    state,
    exports,
    value: () => structuredClone(state),
    mode (readOnly) { state.options.mode = readOnly ? 'readonly' : 'edit' },
    run (name, value) {
      if (state.options.mode === 'readonly') { return }
      if (name === 'bold') { state.data.main[0].bold = !state.data.main[0].bold; style({ bold: state.data.main[0].bold }) } else if (name === 'font') { state.data.main[0].font = value } else if (name === 'landscape') { state.options.paperDirection = 'horizontal' }
      listener()
    },
    edit (value) { state.data.main[0].value = value; listener() },
    async exportCopy (name) { exports.push(name); host.ownerDocument.downloads.push({ name, url: 'managed-download' }) },
    subscribe (change, rangeStyle) { listener = change; style = rangeStyle; return () => { listener = () => {}; style = () => {} } },
    destroy () { destroyed = true },
    get destroyed () { return destroyed }
  }
  return engine
}
