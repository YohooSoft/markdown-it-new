// markdown-it default options

import type { MarkdownItOptions } from '../types.ts'

const options: Required<MarkdownItOptions> = {
  // Enable HTML tags in source
  html: false,

  // Enable restricted HTTPS HTML images
  imageHtml: true,

  // Render GLB/GLTF Markdown images as interactive 3D models
  model3d: true,

  neuralModels: true,
  neuralModelViewerUrl: 'https://netron.app/',
  expandPreview: true,
  documentLinks: true,

  // Enable restricted HTTPS iframe embeds
  iframe: true,

  // Enable GFM-style task list items
  taskLists: true,

  // Add filter and sort controls above task lists
  taskListControls: true,

  // Add per-column filter and sort controls above tables
  tableControls: true,

  // Add toolbar and settings controls above fenced code blocks
  codeControls: true,

  // Parse LaTeX math into MathJax-compatible delimiters
  math: true,

  // Use '/' to close single tags (<br />)
  xhtmlOut: false,

  // Convert '\n' in paragraphs into <br>
  breaks: false,

  // CSS language prefix for fenced blocks
  langPrefix: 'language-',

  // autoconvert URL-like texts to links
  linkify: false,

  // Enable some language-neutral replacements + quotes beautification
  typographer: false,

  // Double + single quotes replacement pairs, when typographer enabled,
  // and smartquotes on. Could be either a String or an Array.
  //
  // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
  // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
  quotes: '\u201c\u201d\u2018\u2019', /* “”‘’ */

  // Highlighter function. Should return escaped HTML,
  // or '' if the source string is not changed and should be escaped externaly.
  // If result starts with <pre... internal wrapper is skipped.
  //
  // function (/*str, lang*/) { return ''; }
  //
  highlight: null,

  // Internal protection, recursion limit
  maxNesting: 100
}

export default {
  options,

  components: {
    core: {},
    block: {},
    inline: {}
  }
}
