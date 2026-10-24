# markdown-it

> This package is based on the original [markdown-it](https://github.com/markdown-it/markdown-it) project and has been modified to add the features maintained in this repository.

[![CI](https://github.com/YohooSoft/markdown-it-new/actions/workflows/ci.yml/badge.svg)](https://github.com/YohooSoft/markdown-it-new/actions/workflows/ci.yml)
[![NPM version](https://img.shields.io/npm/v/%40mryan2005%2Fmarkdown-it-new.svg?style=flat)](https://www.npmjs.org/package/@mryan2005/markdown-it-new)
[![Coverage Status](https://coveralls.io/repos/YohooSoft/markdown-it-new/badge.svg?branch=master&service=github)](https://coveralls.io/github/YohooSoft/markdown-it-new?branch=master)

> Markdown parser done right. Fast and easy to extend.

__[Live demo](https://markdown-it.github.io)__

- Follows the [CommonMark spec](http://spec.commonmark.org/) + adds syntax extensions & sugar (URL autolinking, typographer).
- Configurable syntax! You can add new rules and even replace existing ones.
- High speed.
- Safe by default.
- Community-written __[plugins](https://www.npmjs.org/browse/keyword/markdown-it-plugin)__
  and [other packages](https://www.npmjs.org/browse/keyword/markdown-it) on npm.


> [!NOTE]
> If you are upgrading to v15, see the [migration guide](docs/migration/migration_v15.md).

### [Documentation >>](https://markdown-it.github.io/markdown-it/)


##### Install (node.js):

```bash
npm install markdown-it
```

For a quick look at `dist/` folder contents, see <https://unpkg.com/markdown-it/>.
For browser you can use unpkg.com, esm.sh or any other CDN, which mirror npm
registry.


##### Usage

```js
import MarkdownIt from 'markdown-it'
const md = new MarkdownIt()
const result = md.render('# markdown-it rulezz!')
```

#### HTTPS iframe embeds

Restricted iframe embeds are enabled by default without enabling arbitrary
HTML. Only absolute `https:` sources and safe presentation attributes are
emitted:

```js
const md = new MarkdownIt()
const result = md.render('<iframe src="https://example.com/embed/1"></iframe>')
```

Set `iframe: false` to keep iframe markup escaped as text. The strict
`commonmark` and `zero` presets keep iframe support disabled.

Restricted HTTPS HTML images are enabled by default, even while arbitrary HTML
is disabled. Safe `img` tags keep their image source and display attributes;
event handlers and non-HTTPS sources remain escaped. Set `imageHtml: false` to
disable this support.

Markdown image syntax also recognizes GLB and GLTF models by default:

```md
![Astronaut](https://example.com/models/astronaut.glb)
```

Those sources render as responsive `<model-viewer>` elements with camera
controls, auto-rotation, and AR support. The consuming page must load Google's
`<model-viewer>` Web Component. Set `model3d: false` to keep GLB/GLTF links as
ordinary images.

#### Neural-network model previews

Use the same image syntax to inspect neural-network models:

```md
![Classifier](https://example.com/models/classifier.onnx)
![PyTorch weights](./models/weights.pt)
```

The default preset recognizes `.onnx`, `.pt`, `.pth`, `.torchscript`, `.tflite`,
`.pb`, `.h5`, `.keras`, and `.safetensors` paths, including URLs with query
strings. It renders a model card with a **查看模型** button and a Netron link.
Clicking the button opens an embedded [Netron](https://github.com/lutzroeder/netron)
viewer for inspecting the model's graph, operators, shapes, and tensors.
Available information depends on the file: a PyTorch state dictionary or a
Safetensors file may contain weights without a computation graph. This feature
does not run inference or execute Python model code.

Load the package's browser bundle on the consuming page to enable inline
previews. No model is fetched and no iframe is loaded until a reader opens the
viewer. The viewer receives the model URL when opened; model URLs must be
accessible from the viewer and permit cross-origin requests (CORS). Relative
paths resolve against the consuming page's base URL when clicked. `file:` paths
cannot be loaded this way; serve local models over HTTP(S) or open a downloaded
file directly in Netron. Without the browser bundle, absolute model URLs still
have a working Netron link; for relative paths, that link opens Netron's file
picker instead.

Use your own Netron web deployment for private models or same-origin access:

```js
const md = new MarkdownIt({
  neuralModelViewerUrl: 'https://models.example.com/netron/'
})
```

The viewer URL must use HTTPS; HTTP loopback addresses are also supported for
local development. The viewer must permit iframe embedding, and the consuming
page's content policy must allow it. Set `neuralModels: false` to keep these
sources as ordinary images. The `commonmark` and `zero` presets disable neural
model previews by default; enable the option explicitly when needed. The
existing `model3d` option continues to control only GLB/GLTF previews.
Model images wrapped in Markdown links retain ordinary image output to avoid
nesting buttons and links inside another link.

#### Enlarged previews

The default preset adds a **放大预览** button to tables, images, code blocks,
task lists, block formulas, model cards, and safe iframe embeds. Load the
package's browser bundle on the consuming page to open the content in a
macOS-inspired modal, with 50–300% zoom, a reset button, and a window-filling
mode. Close with **关闭**, Escape, or a click on the backdrop. Focus returns to
the original button when closed.

Drag the title bar to move the preview, or drag any edge/corner to resize it.
The window stays within the visible viewport and has a minimum usable size.
Double-click the title bar to fill/restore the window; restoring returns to
the previous size and position. With the title bar focused, arrow keys move
the window and Shift + arrow keys resize it. These adjustments apply to the
current preview session and work with mouse, pen, or touch input.

Table/task-list menus stay with their content, and filtering, sorting, and
code settings continue to work inside the modal. The original DOM nodes are
restored on close. Browsers supporting `Element.moveBefore()` also preserve
loaded iframe state; on other browsers, moving an iframe can reload its viewer.
Model previews remain click-to-load even inside the enlarged modal. Images
inside links keep the link's normal behavior.

Set `expandPreview: false` to disable these wrappers independently of the other
interactive controls. The `commonmark` and `zero` presets keep enlargement off
unless explicitly enabled. Without the browser bundle, content remains visible
but the enlargement button is inactive. The modal requires native `<dialog>`
support in the browser.

#### Document links: preview, edit, and download a copy

Document links use ordinary link syntax:

```md
[Project brief](./files/brief.docx)
[Notes](https://example.com/notes.txt)
[Reference PDF](./files/reference.pdf)
```

The default preset marks supported file links so a normal click opens the
same movable, resizable modal. Its toolbar can copy the original absolute URL,
open it in another tab, switch between preview and editing, or download a local copy.
Ctrl/Cmd/Shift-click keeps the browser's normal navigation behavior. Load the
browser bundle to enable these interactions; otherwise the links work normally.

- **DOCX:** uses this project's own OOXML model and DOM editor, with white
  paper pages, paragraph editing, selected-text formatting, undo/redo, Enter
  to split paragraphs, alignment, line spacing, and basic page layout. Plain
  text pasted across lines is merged into one paragraph. Existing tables have
  a basic grid preview; supported embedded raster images display locally.
  No third-party DOCX editing engine or online document service is used;
  `fflate` handles ZIP compression only. Downloads change supported nodes in
  `word/document.xml` and preserve every other package part; unmodified files
  retain their exact original bytes. Complex paragraphs are read-only, and
  unsupported objects have placeholders. Pagination keeps paragraphs/tables
  together; oversized blocks grow beyond a normal page. Headers, footers,
  numbering, merged-cell layout, fields, and advanced Word layout are not yet
  faithfully rendered. Protected/signed files are read-only. See the
  [staged DOCX roadmap](docs/docx-engine.md) for the current boundaries.
- **XLSX:** groups existing cells by worksheet for raw-value editing, preserving
  the remaining package. Formula cells and protected ranges are read-only;
  formulas recalculate when opened in Excel. `.xlxs` is accepted as an alias.
- **PPTX:** groups existing editable text by slide order and preserves other
  package parts. This is a text editor, not a graphical slide-layout editor.
- **Text:** `.txt`, `.md`, `.csv`, `.tsv`, `.json`, `.yaml`, `.yml`, `.xml`, and
  `.log` files support UTF-8 text preview/editing; a UTF-8 BOM is retained.
- **PDF:** previews the original pages and supports adding/editing per-page
  sticky-note annotations in downloaded copies. Original page text cannot be
  replaced. Signed or certified PDFs are read-only.
- **Other Office files:** `.doc`, `.xls`, `.ppt`, `.rtf`, and
  `.odt` offer an explicit **使用 Office 在线预览（公开文件）** action. That
  third-party viewer receives the URL only when selected, requires a publicly
  accessible HTTPS file, and is read-only in this integration.

Edits stay in the current browser session. The package never sends PUT/POST
requests to save changes to the source server. On closing modified content,
including via Escape or the backdrop, the reader chooses **下载副本并关闭**,
**不下载，关闭**, or **继续编辑**. Downloading initiates a local file download and
marks that revision as exported; reverting to the last exported text also
clears the unsaved state. Page navigation uses the browser's unsaved-change
prompt when supported; browsers control whether that prompt appears.

Direct editing requires HTTP(S) access to the file and CORS permission for
cross-origin files. Requests use same-origin credentials; encrypted/password-
protected files and non-UTF-8 text are unsupported. Office/PDF downloads are limited
to 20 MB, decompressed packages to 80 MB, and editable text files to 2 MB.
Set `documentLinks: false` to keep ordinary link navigation. The `commonmark`
and `zero` presets disable this extension by default. Document modals work
independently of `expandPreview`.

#### LaTeX math

LaTeX math is enabled by default and is emitted with MathJax-compatible
delimiters:

```md
Inline formula: $E=mc^2$

$$
\\int_0^1 x^2\\,dx = \\frac{1}{3}
$$
```

The page rendering the result must load MathJax to typeset the formulas. Set
`math: false` to keep dollar-delimited expressions as ordinary text.

#### Ordered task lists

GFM-style task markers are enabled by default and keep the ordered-list
numbering. A responsive menu above each task list can filter completed or
pending items and sort them while retaining an original-order option:

```js
const result = md.render('1. [ ] first\n2. [x] finished')
// <div class="task-list-menu" data-task-list-menu>...</div>
// <ol class="contains-task-list task-list-controlled" data-task-list="">
// <li class="task-list-item" data-task-status="pending"><input ...> first</li>
// <li class="task-list-item"><input class="task-list-item-checkbox" type="checkbox" checked disabled> finished</li>
```

Set `taskLists: false` to keep task markers as ordinary text. The strict
`commonmark` preset keeps this GFM extension disabled unless you pass
`taskLists: true` explicitly.

Set `taskListControls: false` to render task checkboxes without the filter and
sort menu.

#### Interactive tables

Tables receive a responsive topbar above the table by default. It provides
`排序`, `筛选`, and `还原` actions. Choosing `排序` or `筛选` reveals the
corresponding control inside each column header. Multiple column sorts are
applied from left to right.

```js
const result = md.render('| Project | Status |\n| --- | --- |\n| A | Done |\n| B | Pending |')
// <div class="table-controls-menu" data-table-controls-menu>...</div>
// <table class="table-controlled" data-table-controlled="">...</table>
```

Set `tableControls: false` to render ordinary tables without the filter and
sort menu.

Task markers at the start of table cells are rendered as disabled checkbox
controls while keeping the cell text:

```js
const result = md.render('| Task | Status |\n| --- | --- |\n| [ ] Write docs | [x] Done |')
// <td class="task-cell" data-task-status="pending">
//   <input class="task-list-item-checkbox" type="checkbox" disabled> Write docs
```

[More usage examples](docs/usage.md).
