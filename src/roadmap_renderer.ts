import { escapeHtml } from './common/utils.ts'
import type { Roadmap } from './common/roadmap.ts'

/** Inline styles keep server-rendered cards usable without the browser bundle. */
export function renderRoadmap (roadmap: Roadmap): string {
  const headingStyle = 'margin:0;padding:0;border:0;color:inherit;font-family:inherit;font-size:1em;font-weight:700;line-height:1.3;letter-spacing:normal;'
  const badge = roadmap.badge
    ? '<span data-roadmap-badge style="flex:none;max-width:100%;box-sizing:border-box;padding:.1em .5em;border-radius:999px;background:#eee;color:#111;font-size:.8em;line-height:1.25;overflow-wrap:anywhere">' + escapeHtml(roadmap.badge) + '</span>'
    : ''
  const items = roadmap.items.map((item, index) => {
    const last = index === roadmap.items.length - 1
    const line = last ? '' : '<span data-roadmap-connector aria-hidden="true" style="position:absolute;top:1.4333em;bottom:.3em;left:.6667em;width:.1em;border-radius:999px;background:#e3e3e3;transform:translateX(-50%)"></span>'
    const title = (item.period ? escapeHtml(item.period) + ' • ' : '') + escapeHtml(item.title)
    const description = item.description
      ? '<p data-roadmap-description style="margin:1.1333em 0 0;padding:0;color:inherit;font:inherit;white-space:pre-wrap;overflow-wrap:anywhere">' + escapeHtml(item.description) + '</p>'
      : ''
    return '<li data-roadmap-step style="position:relative;display:grid;grid-template-columns:1.3333em minmax(0,1fr);column-gap:.5em;margin:0;padding:0 0 ' + (last ? '.7667em' : '.9333em') + ';border:0;list-style:none">' +
      line + '<span data-roadmap-number aria-hidden="true" style="text-align:center">' + (index + 1) + '</span>' +
      '<div style="min-width:0"><h4 data-roadmap-step-title style="' + headingStyle + '">' + title + '</h4>' + description + '</div></li>'
  }).join('')
  const note = roadmap.note
    ? '<p data-roadmap-note style="margin:0;padding:0;color:#666;font:inherit;font-size:.8em;line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere">' + escapeHtml(roadmap.note) + '</p>'
    : ''
  return '<section class="roadmap" data-roadmap aria-label="' + escapeHtml(roadmap.title) + '" style="container-type:inline-size;box-sizing:border-box;max-width:100%;margin:16px 0;border:1px solid #dedede;border-radius:20px;background:#fcfcfc;color:#111;text-align:left">' +
    '<div style="box-sizing:border-box;padding:.7333em .7em .6333em;font:400 20px/1.3 Arial,Helvetica,sans-serif;font-size:clamp(16px,2.2556cqi,30px);overflow-wrap:anywhere">' +
    '<header data-roadmap-header style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.5em 1em;min-height:1.4em;margin:0 0 .9667em;padding:0">' +
    '<h3 data-roadmap-title style="' + headingStyle + 'min-width:0">' + escapeHtml(roadmap.title) + '</h3>' + badge + '</header>' +
    '<ol data-roadmap-items role="list" style="margin:0;padding:0;list-style:none">' + items + '</ol>' + note + '</div></section>\n'
}
