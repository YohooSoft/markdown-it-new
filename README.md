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
