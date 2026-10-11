const installedDocuments = new WeakSet<Document>()

type TableSort = 'asc' | 'desc'

function compareCellText (left: string, right: string): number {
  const leftNumber = Number(left.replace(/[\s,%，％]/g, ''))
  const rightNumber = Number(right.replace(/[\s,%，％]/g, ''))

  if (left !== '' && right !== '' && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber
  }

  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
}

function updateTable (menu: HTMLElement): void {
  const table = menu.nextElementSibling
  if (!(table instanceof HTMLTableElement) || !table.matches('table[data-table-controlled]')) {
    return
  }

  const body = table.tBodies[0]
  if (!body) { return }

  const filters = Array.from(menu.querySelectorAll<HTMLInputElement>('[data-table-filter]'))
  const sorts = Array.from(menu.querySelectorAll<HTMLSelectElement>('[data-table-sort]'))
  const summary = menu.querySelector<HTMLElement>('[data-table-summary]')
  const rows = Array.from(body.rows)

  rows.forEach((row, index) => {
    if (row.dataset.tableIndex === undefined) {
      row.dataset.tableIndex = String(index)
    }
  })

  const activeSorts = sorts
    .filter(control => control.value === 'asc' || control.value === 'desc')
    .map(control => ({
      column: Number(control.dataset.tableColumn ?? 0),
      direction: control.value as TableSort
    }))

  rows.sort((left, right) => {
    for (const sort of activeSorts) {
      const leftText = left.cells[sort.column]?.textContent?.trim() ?? ''
      const rightText = right.cells[sort.column]?.textContent?.trim() ?? ''
      const comparison = compareCellText(leftText, rightText)
      if (comparison !== 0) {
        return sort.direction === 'asc' ? comparison : -comparison
      }
    }
    return Number(left.dataset.tableIndex ?? 0) - Number(right.dataset.tableIndex ?? 0)
  })

  let visibleRows = 0
  for (const row of rows) {
    const visible = filters.every(filter => {
      const query = filter.value.trim().toLocaleLowerCase()
      if (!query) { return true }
      const column = Number(filter.dataset.tableColumn ?? 0)
      return (row.cells[column]?.textContent ?? '').toLocaleLowerCase().includes(query)
    })

    row.hidden = !visible
    if (visible) { visibleRows++ }
    body.append(row)
  }

  if (summary) {
    summary.textContent = `显示 ${visibleRows} / ${rows.length} 行`
  }
}

function resetTable (menu: HTMLElement): void {
  menu.querySelectorAll<HTMLInputElement>('[data-table-filter]').forEach(control => {
    control.value = ''
  })
  menu.querySelectorAll<HTMLSelectElement>('[data-table-sort]').forEach(control => {
    control.value = ''
  })
  updateTable(menu)

  const table = menu.nextElementSibling
  const summary = menu.querySelector<HTMLElement>('[data-table-summary]')
  if (table instanceof HTMLTableElement && summary) {
    summary.textContent = `共 ${table.tBodies[0]?.rows.length ?? 0} 行 · ${table.dataset.tableColumns ?? 0} 列`
  }
}

function toggleTableSettings (menu: HTMLElement, button: HTMLElement): void {
  const panel = menu.querySelector<HTMLElement>('[data-table-controls-panel]')
  if (!panel) { return }

  const isOpening = panel.hasAttribute('hidden')
  if (isOpening) {
    panel.removeAttribute('hidden')
  } else {
    panel.setAttribute('hidden', '')
  }
  button.setAttribute('aria-expanded', String(isOpening))
  button.textContent = isOpening ? '收起设置' : '设置'
}

function handleTableControlEvent (event: Event): void {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const menu = target.closest<HTMLElement>('[data-table-controls-menu]')
  if (!menu) { return }

  if (target.matches('[data-table-reset]')) {
    resetTable(menu)
  } else if (target.matches('[data-table-settings]')) {
    toggleTableSettings(menu, target as HTMLElement)
  } else if (target.matches('[data-table-filter], [data-table-sort]')) {
    updateTable(menu)
  }
}

function installTableControls (doc: Document): void {
  if (installedDocuments.has(doc)) { return }
  doc.addEventListener('click', handleTableControlEvent)
  doc.addEventListener('input', handleTableControlEvent)
  doc.addEventListener('change', handleTableControlEvent)
  installedDocuments.add(doc)
}

if (typeof document !== 'undefined') {
  installTableControls(document)
}

export {}
