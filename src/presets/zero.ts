// "Zero" preset, with nothing enabled. Useful for manual configuring of simple
// modes. For example, to parse bold/italic only.

import type { MarkdownItOptions } from '../types.ts'

const options: Required<MarkdownItOptions> = {
  // Enable HTML tags in source
  html: false,

  // Keep image HTML disabled in the zero preset
  imageHtml: false,

  // Keep 3D model rendering disabled in the zero preset
  model3d: false,

  neuralModels: false,
  neuralModelViewerUrl: 'https://netron.app/',
  expandPreview: false,
  documentLinks: false,

  // Enable restricted HTTPS iframe embeds
  iframe: false,

  // Enable GFM-style task list items
  taskLists: false,

  // Keep task-list controls disabled in the zero preset
  taskListControls: false,

  // Keep table controls disabled in the zero preset
  tableControls: false,

  // Keep code controls disabled in the zero preset
  codeControls: false,

  // Keep LaTeX math disabled in the zero preset
  math: false,

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
  maxNesting: 20
}

export default {
  options,

  components: {

    core: {
      rules: [
        'normalize',
        'block',
        'strip_references',
        'inline',
        'text_join'
      ]
    },

    block: {
      rules: [
        'paragraph'
      ]
    },

    inline: {
      rules: [
        'text'
      ],
      rules2: [
        'balance_pairs',
        'fragments_join'
      ]
    }
  }
}
