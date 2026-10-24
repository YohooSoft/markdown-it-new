import MarkdownIt, { type Token } from '@mryan2005/markdown-it-new'

const parser = new MarkdownIt({ html: true })
const tokens: Token[] = parser.parse('abc', {})

export { parser, tokens }
