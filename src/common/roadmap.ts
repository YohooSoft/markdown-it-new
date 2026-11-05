/** Plain-text content for a numbered roadmap card. */
export interface Roadmap {
  title: string
  badge?: string
  note?: string
  items: Array<{ title: string, period?: string, description?: string }>
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Invalid or incomplete input stays an ordinary fenced code block. */
export function parseRoadmap (source: string): Roadmap | null {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    return null
  }
  if (!isRecord(value) || typeof value.title !== 'string' || !value.title.trim() ||
    !Array.isArray(value.items) || !value.items.length) { return null }
  if (['badge', 'note'].some(key => value[key] !== undefined && typeof value[key] !== 'string')) { return null }

  const items: Roadmap['items'] = []
  for (const item of value.items) {
    if (!isRecord(item) || typeof item.title !== 'string' || !item.title.trim() ||
      ['period', 'description'].some(key => item[key] !== undefined && typeof item[key] !== 'string')) { return null }
    items.push({ title: item.title, period: item.period as string | undefined, description: item.description as string | undefined })
  }
  return { title: value.title, badge: value.badge as string | undefined, note: value.note as string | undefined, items }
}
