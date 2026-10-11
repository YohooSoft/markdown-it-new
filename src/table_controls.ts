const installedDocuments = new WeakSet<Document>()

type TableSort = 'asc' | 'desc'
type TableMode = 'sort' | 'filter' | 'none'

function compareCellText (left: string, right: string): number {
  const leftNumber = Number(left.replace(/[\s,%，％]/g, ''))
  const rightNumber = Number(right.replace(/[\s,%，％]/g, ''))

  if (left !== '' && right !== '' && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber
  }

  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
}

function tableForMenu (menu: HTMLElement): HTMLTableElement | null {
  const table = menu.nextElementSibling
  return table instanceof HTMLTableElement && table.matches('table[data-table-controlled]')
    ? table
    : null
}

function updateTable (menu: HTMLElement): void {
  const table = tableForMenu(menu)
  if (!table) { return }
  const body = table.tBodies[0]
  if (!body) { return }

  const filters = Array.from(table.querySelectorAll<HTMLInputElement>('[data-table-filter]'))
  const sorts = Array.from(table.querySelectorAll<HTMLSelectElement>('[data-table-sort]'))
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
  const table = tableForMenu(menu)
  if (!table) { return }

  table.querySelectorAll<HTMLInputElement>('[data-table-filter]').forEach(control => {
    control.value = ''
  })
  table.querySelectorAll<HTMLSelectElement>('[data-table-sort]').forEach(control => {
    control.value = ''
  })
  setTableMode(menu, 'none')
  updateTable(menu)

  const summary = menu.querySelector<HTMLElement>('[data-table-summary]')
  if (summary) {
    summary.textContent = `共 ${table.tBodies[0]?.rows.length ?? 0} 行 · ${table.dataset.tableColumns ?? 0} 列`
  }
}

function setTableMode (menu: HTMLElement, mode: TableMode): void {
  const table = tableForMenu(menu)
  if (!table) { return }

  table.querySelectorAll<HTMLElement>('[data-table-column-control-mode]').forEach(control => {
    control.hidden = control.dataset.tableColumnControlMode !== mode
  })

  menu.querySelectorAll<HTMLButtonElement>('[data-table-mode-button]').forEach(button => {
    const active = button.dataset.tableModeButton === mode
    button.setAttribute('aria-pressed', String(active))
    button.style.background = active ? '#e2e8f0' : 'rgba(255,255,255,.72)'
    button.style.color = active ? '#0f172a' : '#475569'
  }
  )
}

function handleTableControlEvent (event: Event): void {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const menu = target.closest<HTMLElement>('[data-table-controls-menu]')
  const table = target.closest<HTMLTableElement>('table[data-table-controlled]')

  if (target.matches('[data-table-reset]')) {
    if (menu) { resetTable(menu) }
  } else if (target.matches('[data-table-mode-button]')) {
    if (menu) {
      setTableMode(menu, (target as HTMLElement).dataset.tableModeButton as TableMode)
    }
  } else if (target.matches('[data-table-filter], [data-table-sort]')) {
    const tableMenu = table
      ? table.previousElementSibling instanceof HTMLElement && table.previousElementSibling.matches('[data-table-controls-menu]')
        ? table.previousElementSibling
        : null
      : null
    if (tableMenu) { updateTable(tableMenu) }
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
