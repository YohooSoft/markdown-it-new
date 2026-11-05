import { parseRoadmap } from '../common/roadmap.ts'
import type StateCore from './state_core.ts'

export default function roadmap (state: StateCore): void {
  if (!state.md.options.roadmaps) { return }
  for (const token of state.tokens) {
    if (token.type !== 'fence' || token.info.trim() !== 'roadmap') { continue }
    const data = parseRoadmap(token.content)
    if (!data) { continue }
    token.type = 'roadmap'
    token.tag = 'section'
    token.meta = { ...token.meta, roadmap: data }
  }
}
