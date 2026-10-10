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

#### Ordered task lists

GFM-style task markers are enabled by default and keep the ordered-list
numbering:

```js
const result = md.render('1. [ ] first\n2. [x] finished')
// <ol class="contains-task-list">
// <li class="task-list-item">[ ] first</li>
// <li class="task-list-item">[x] finished</li>
```

Set `taskLists: false` to keep task markers as ordinary text. The strict
`commonmark` preset keeps this GFM extension disabled unless you pass
`taskLists: true` explicitly.

[More usage examples](docs/usage.md).
