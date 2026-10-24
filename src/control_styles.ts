// Shared presentation for this package's generated controls only.
export const controlButtonStyle = 'display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:28px;padding:6px 11px;border:1px solid #d4d4da;border-radius:6px;background:linear-gradient(#fff,#fafafa);color:#424249;font:500 12px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.05);cursor:pointer;box-sizing:border-box;'
export const controlSelectStyle = 'min-width:108px;max-width:100%;min-height:28px;padding:5px 24px 5px 10px;border:1px solid #d4d4da;border-radius:6px;background:linear-gradient(#fff,#fafafa);color:#424249;font:500 12px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.05);cursor:pointer;box-sizing:border-box;'
export const controlToolbarStyle = 'gap:12px 18px;margin:16px 0 8px;padding:14px 16px;border:1px solid #dedee3;border-radius:10px;background:linear-gradient(180deg,#fafafa,#f2f2f5);box-shadow:0 2px 5px rgba(30,41,59,.02);color:#64748b;font:500 13px/1.5 system-ui,-apple-system,&quot;Segoe UI&quot;,sans-serif;'
export const controlPopoverStyle = 'position:relative;z-index:5;box-sizing:border-box;margin:8px;padding:16px;border:1px solid #dedee3;border-radius:10px;background:rgba(255,255,255,.96);backdrop-filter:blur(20px);box-shadow:0 12px 36px rgba(0,0,0,.12),0 2px 6px rgba(0,0,0,.04);font:500 13px/1.5 system-ui,sans-serif;color:#475569;'

const scope = ':is([data-code-block],[data-task-list-menu],[data-table-controls-menu],[data-table-controlled],[data-task-list])'
const styles = `
${scope} { -webkit-font-smoothing:antialiased; }
${scope} [hidden], ${scope}[hidden] { display:none !important; }
${scope} :is(button,select,input) { transition:background-color .15s,border-color .15s,box-shadow .15s; }
${scope} :is(button,select):hover { border-color:#80b8ff !important; background:#e8f2ff !important; }
${scope} :is(button,select,input):focus-visible { outline:3px solid #80b8ff; outline-offset:3px; }
${scope} button:disabled { opacity:.5; cursor:wait; }
${scope} button[aria-pressed="true"], ${scope} button[aria-selected="true"] { color:#0066d6 !important; background:#e8f2ff !important; border-color:#b5d6ff !important; }
[data-code-toolbar] { flex-wrap:wrap; }
[data-code-actions] { flex-wrap:wrap; margin-left:auto; }
[data-code-preview] { flex:1 1 60px; }
[data-code-pre] { border-radius:0 0 13px 13px; scrollbar-width:thin; scrollbar-color:#cbd5e1 transparent; }
[data-code-line-number] { display:inline-block; }
[data-code-settings-menu] label { flex-wrap:wrap; margin-bottom:12px; }
[data-code-settings-menu] input { accent-color:#007aff; }
[data-task-list] { padding:4px 0 4px 28px; color:#475569; font:14px/1.8 system-ui,sans-serif; }
[data-task-list] > .task-list-item { padding:7px 8px; border-bottom:1px solid #eef1f6; }
[data-task-list] > [data-task-status="completed"] { color:#94a3b8; }
[data-task-list] .task-list-item-checkbox, [data-table-controlled] .task-list-item-checkbox { width:15px; height:15px; margin:0 7px 0 0; accent-color:#007aff; vertical-align:-2px; }
table[data-table-controlled] { width:100%; border-collapse:separate; border-spacing:0; border:1px solid #dedee3; border-radius:10px; background:#fff; color:#475569; font:13px/1.6 system-ui,sans-serif; }
[data-table-controlled] :is(th,td) { padding:12px 16px; border:0; border-bottom:1px solid #edf0f6; text-align:start; }
[data-table-controlled] th { background:#f5f5f7; color:#334155; font-weight:600; }
[data-table-controlled] th:first-child { border-radius:10px 0 0; }
[data-table-controlled] th:last-child { border-radius:0 10px 0 0; }
[data-table-controlled] tbody tr:last-child td { border-bottom:0; }
[data-table-controlled] tbody tr:hover { background:#f8faff; }
[data-table-filter-values] label { padding:7px 8px !important; border-radius:6px; }
[data-table-filter-values] label:hover { background:#f1f5ff; }
[data-table-filter-values] input { accent-color:#007aff !important; }
[data-table-filter-popover] > div:first-child { flex-wrap:wrap; }
@media (max-width:600px) {
  [data-code-toolbar] { padding:12px !important; gap:10px !important; }
  [data-code-actions] { width:100%; margin-left:0; gap:6px !important; }
  [data-code-preview] { max-width:none !important; order:1; flex-basis:100%; padding-top:6px; font-size:12px; }
  [data-code-pre] { padding:16px !important; }
  [data-code-code] { font-size:12px !important; }
  [data-table-controlled] :is(th,td) { padding:9px 8px; overflow-wrap:anywhere; }
  [data-table-filter-popover] { position:fixed !important; top:25% !important; left:16px !important; width:calc(100vw - 32px); max-width:none !important; min-width:0 !important; }
}
@media (prefers-reduced-motion:reduce) { ${scope} * { transition:none !important; animation:none !important; } }
`

if (typeof document !== 'undefined' && !document.querySelector('[data-markdown-it-control-style]')) {
  const style = document.createElement('style')
  style.setAttribute('data-markdown-it-control-style', '')
  style.textContent = styles
  ;(document.head || document.documentElement).append(style)
}
