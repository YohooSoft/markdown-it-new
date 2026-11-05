import { fileURLToPath } from 'node:url'
import { describe } from 'node:test'
import { generateTests } from '../helpers.mjs'
import markdownit from '../../src/index.ts'

const fixtures = [
  'commonmark_extras.txt',
  'fatal.txt',
  'linkify.txt',
  'normalize.txt',
  'proto.txt',
  'smartquotes.txt',
  'strikethrough.txt',
  'tables.txt',
  'typographer.txt',
  'xss.txt'
]

describe('markdown-it', function () {
  const md = markdownit({
    // Upstream fixtures assert plain HTML; preview wrappers have dedicated tests.
    expandPreview: false,
    documentLinks: false,
    codeControls: false,
    tableControls: false,
    taskListControls: false,
    taskLists: false,
    imageHtml: false,
    model3d: false,
    neuralModels: false,
    math: false,
    html: true,
    langPrefix: '',
    typographer: true,
    linkify: true
  })

  fixtures.forEach(name => {
    generateTests(fileURLToPath(new URL(`../fixtures/markdown-it/${name}`, import.meta.url)), md)
  })
})
