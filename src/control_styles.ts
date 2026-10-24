// Shared presentation for this package's generated controls only.
export const controlButtonStyle = 'display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:28px;padding:6px 11px;border:1px solid #d4d4da;border-radius:6px;background:linear-gradient(#fff,#fafafa);color:#424249;font:500 12px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.05);cursor:pointer;box-sizing:border-box;'
export const controlSelectStyle = 'min-width:108px;max-width:100%;min-height:28px;padding:5px 24px 5px 10px;border:1px solid #d4d4da;border-radius:6px;background:linear-gradient(#fff,#fafafa);color:#424249;font:500 12px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.05);cursor:pointer;box-sizing:border-box;'
export const controlToolbarStyle = 'gap:12px 18px;margin:16px 0 8px;padding:14px 16px;border:1px solid #dedee3;border-radius:10px;background:linear-gradient(180deg,#fafafa,#f2f2f5);box-shadow:0 2px 5px rgba(30,41,59,.02);color:#64748b;font:500 13px/1.5 system-ui,-apple-system,&quot;Segoe UI&quot;,sans-serif;'
export const controlPopoverStyle = 'position:relative;z-index:5;box-sizing:border-box;margin:8px;padding:16px;border:1px solid #dedee3;border-radius:10px;background:rgba(255,255,255,.96);backdrop-filter:blur(20px);box-shadow:0 12px 36px rgba(0,0,0,.12),0 2px 6px rgba(0,0,0,.04);font:500 13px/1.5 system-ui,sans-serif;color:#475569;'

const scope = ':is([data-code-block],[data-task-list-menu],[data-table-controls-menu],[data-table-controlled],[data-task-list],[data-neural-model],[data-preview-container],[data-preview-dialog],[data-document-unsaved])'
const styles = `
${scope} { -webkit-font-smoothing:antialiased; }
${scope} [hidden], ${scope}[hidden] { display:none !important; }
${scope} :is(button,select,input) { transition:background-color .15s,border-color .15s,box-shadow .15s; }
${scope} :is(button,select):not(:disabled):hover { border-color:#80b8ff !important; background:#e8f2ff !important; }
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
[data-preview-container] { display:block; max-width:100%; }
[data-preview-container] img { max-width:100%; height:auto; }
[data-preview-content] { display:block; }
[data-preview-toolbar] { display:flex; justify-content:flex-end; margin:8px 0 5px; }
[data-preview-dialog] { box-sizing:border-box; width:min(1200px,calc(100vw - 48px)); height:min(820px,calc(100dvh - 48px)); max-width:none; max-height:none; padding:0; border:1px solid #d4d4da; border-radius:16px; background:#fff; color:#424249; box-shadow:0 24px 100px #0004; font:13px/1.6 -apple-system,BlinkMacSystemFont,system-ui,sans-serif; }
[data-preview-dialog][open] { display:flex; flex-direction:column; }
[data-preview-dialog]::backdrop { background:#16161c66; backdrop-filter:blur(6px); }
[data-preview-header] { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:13px 18px; border-bottom:1px solid #dedee3; background:linear-gradient(#fafafa,#eeeef1); cursor:grab; touch-action:none; user-select:none; }
[data-preview-header]:focus-visible { outline:3px solid #80b8ff; outline-offset:-3px; }
[data-preview-header] > strong { flex:1 1 120px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
[data-preview-tools] { display:flex; flex-wrap:wrap; gap:6px; }
[data-preview-tools] :is(button,a) { white-space:nowrap; }
[data-preview-tools] button:disabled { cursor:default; }
[data-preview-viewport] { flex:1; min-height:0; overflow:auto; overscroll-behavior:contain; padding:24px; }
[data-preview-dialog] [data-preview-toolbar] { display:none; }
[data-preview-dialog] [data-preview-content] > img { display:block; max-width:100% !important; max-height:none !important; height:auto; margin:auto; }
[data-preview-dialog] :is(iframe,model-viewer) { width:100% !important; height:var(--preview-media-height,calc(100dvh - 220px)) !important; min-height:120px !important; }
[data-preview-dialog] pre { overflow:auto; }
[data-preview-dialog] table { min-width:100%; }
[data-preview-dialog][data-preview-maximized="true"] { width:100vw; height:100dvh; margin:0; border-radius:0; }
[data-preview-dialog][data-preview-maximized="true"] [data-preview-header] { cursor:default; }
[data-preview-resize] { position:absolute; z-index:10; touch-action:none; user-select:none; }
[data-preview-resize="n"], [data-preview-resize="s"] { left:14px; right:14px; height:8px; cursor:ns-resize; }
[data-preview-resize="n"] { top:0; }
[data-preview-resize="s"] { bottom:0; }
[data-preview-resize="e"], [data-preview-resize="w"] { top:14px; bottom:14px; width:8px; cursor:ew-resize; }
[data-preview-resize="e"] { right:0; }
[data-preview-resize="w"] { left:0; }
[data-preview-resize="ne"], [data-preview-resize="nw"], [data-preview-resize="se"], [data-preview-resize="sw"] { width:14px; height:14px; }
[data-preview-resize="ne"] { top:0; right:0; cursor:nesw-resize; }
[data-preview-resize="nw"] { top:0; left:0; cursor:nwse-resize; }
[data-preview-resize="se"] { bottom:0; right:0; cursor:nwse-resize; border-right:2px solid #a1a1aa; border-bottom:2px solid #a1a1aa; border-radius:0 0 8px; margin:4px; }
[data-preview-resize="sw"] { bottom:0; left:0; cursor:nesw-resize; }
[data-preview-maximized="true"] [data-preview-resize] { display:none; }
[data-preview-adjusting] { user-select:none; }
[data-preview-adjusting] iframe { pointer-events:none; }
[data-preview-adjusting="move"] [data-preview-header] { cursor:grabbing; }
[data-document-toolbar] { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding-bottom:12px; border-bottom:1px solid #dedee3; }
[data-document-toolbar] button:disabled { cursor:default; }
[data-document-dirty] { color:#8a661b; font-size:12px; }
[data-document-status] { margin:12px 0; color:#73737c; font-size:12px; white-space:pre-wrap; }
[data-document-status] input { display:block; width:100%; margin-top:8px; }
[data-document-text] { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; }
[data-document-field] { margin:12px 0; }
[data-document-input] { display:none; box-sizing:border-box; width:100%; min-height:40px; padding:8px 10px; border:1px solid #d4d4da; border-radius:6px; background:#fff; color:#303038; font:inherit; }
textarea[data-document-input] { min-height:360px; resize:vertical; font-family:ui-monospace,Consolas,monospace; }
[data-document-editing="true"] [data-document-input] { display:block; }
[data-document-editing="true"] [data-document-text] { display:none; }
[data-document-body] iframe { display:block; border:0; border-radius:8px; }
[data-document-group] { margin:20px 0; }
[data-document-group] h3 { margin:0 0 12px; font-size:15px; }
[data-document-group] table { border-collapse:collapse; font-size:13px; }
[data-document-group] :is(th,td) { padding:6px 9px; border:1px solid #dedee3; min-width:80px; }
[data-document-group] th { background:#f5f5f7; font-weight:500; }
[data-document-group] td [data-document-field] { margin:0; }
[data-document-format="xlsx"] [data-document-input] { min-width:100px; }
[data-document-format="pptx"] [data-document-group] { padding:24px; border:1px solid #dedee3; border-radius:12px; background:#fff; box-shadow:0 3px 12px #00000008; }
[data-document-format="pdf"] textarea[data-document-input] { min-height:110px; }
[data-document-editing="true"] iframe[data-document-pdf-preview] { height:260px !important; }
[data-word-editor] { border:1px solid #d4d4da; border-radius:10px; overflow:clip; background:#e7e7ea; }
[data-word-ribbon] { position:sticky; top:0; z-index:3; display:flex; flex-wrap:wrap; gap:8px; padding:12px; border-bottom:1px solid #d4d4da; background:#f5f5f7; }
[data-word-group] { display:flex; flex-wrap:wrap; align-items:center; gap:5px; padding:0 10px 0 0; border-right:1px solid #dedee3; }
[data-word-group] small { order:2; flex-basis:100%; text-align:center; color:#73737c; font-size:10px; }
[data-word-ribbon] :is(button,select,input) { box-sizing:border-box; min-height:28px; padding:3px 7px; border:1px solid #d4d4da; border-radius:5px; background:#fff; color:#424249; font:12px/1.5 system-ui,sans-serif; }
[data-word-ribbon] button { cursor:pointer; }
[data-word-ribbon] :disabled { cursor:default !important; opacity:.5; }
[data-word-ribbon] input[type="color"] { width:32px; padding:2px; }
[data-word-ribbon] input[type="file"] { max-width:150px; }
[data-word-pages] { min-width:0; box-sizing:border-box; overflow-x:auto; padding:24px; background:#e7e7ea; }
[data-docx-page] { box-sizing:border-box; margin:0 auto 20px; background:#fff; color:#111; box-shadow:0 2px 10px #0002; overflow-wrap:anywhere; }
[data-docx-page]:last-child { margin-bottom:0; }
[data-docx-paragraph] { min-height:1.5em; white-space:pre-wrap; outline:none; tab-size:4; }
[data-docx-paragraph][contenteditable="plaintext-only"]:focus { outline:1px solid #007aff55; outline-offset:3px; }
[data-docx-object] { display:inline-block; padding:2px 5px; border:1px dashed #b5b5bd; border-radius:3px; color:#73737c; font:11px/1.5 system-ui,sans-serif; }
[data-docx-page] table[data-docx-table] { width:100%; min-width:0; border-collapse:collapse; table-layout:fixed; }
[data-docx-table] td { padding:5px; border:1px solid #c7c7cc; vertical-align:top; }
[data-docx-table] [data-docx-paragraph]:last-child { margin-bottom:0 !important; }
[data-word-hint] { margin:0; padding:10px 14px; background:#f5f5f7; color:#73737c; font-size:11px; }
[data-document-unsaved] { max-width:min(460px,calc(100vw - 40px)); box-sizing:border-box; padding:24px; border:1px solid #d4d4da; border-radius:14px; background:#fafafa; color:#424249; box-shadow:0 20px 80px #0004; font:13px/1.6 system-ui,sans-serif; }
[data-document-unsaved]::backdrop { background:#16161c55; }
[data-document-unsaved] h2 { margin:0 0 8px; font-size:17px; }
[data-document-unsaved] p { margin:0 0 18px; color:#73737c; }
[data-document-choice] { margin:5px 6px 0 0; padding:7px 10px; border:1px solid #d4d4da; border-radius:7px; background:#fff; color:#424249; font:inherit; cursor:pointer; }
[data-document-choice="download"] { background:#007aff; border-color:#007aff; color:#fff; }
button[data-document-choice="download"]:not(:disabled):hover { background:#0066d6 !important; color:#fff; }
@media (max-width:600px) {
  [data-preview-dialog] { width:calc(100vw - 20px); height:calc(100dvh - 20px); }
  [data-preview-header] { padding:10px 12px; }
  [data-preview-viewport] { padding:12px; }
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
