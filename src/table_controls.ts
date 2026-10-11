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
  const sorts = Array.from(table.querySelectorAll<HTMLElement>('[data-table-sort-button]'))
  const summary = menu.querySelector<HTMLElement>('[data-table-summary]')
  const rows = Array.from(body.rows)

  rows.forEach((row, index) => {
    if (row.dataset.tableIndex === undefined) {
      row.dataset.tableIndex = String(index)
    }
  })

  const activeSorts = sorts
    .filter(control => control.dataset.tableSortDirection === 'asc' || control.dataset.tableSortDirection === 'desc')
    .map(control => ({
      column: Number(control.dataset.tableColumn ?? 0),
      direction: control.dataset.tableSortDirection as TableSort
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

  table.querySelectorAll<HTMLElement>('[data-table-filter-button]').forEach(button => {
    const column = button.dataset.tableColumn ?? '0'
    const input = table.querySelector<HTMLInputElement>(`[data-table-filter][data-table-column="${column}"]`)
    const active = Boolean(input?.value.trim())
    button.style.color = active ? '#2563eb' : '#64748b'
    button.style.background = active ? '#dbeafe' : 'rgba(255,255,255,.72)'
  })

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
  table.querySelectorAll<HTMLElement>('[data-table-sort-button]').forEach(button => {
    button.dataset.tableSortDirection = 'none'
    updateSortButton(button)
  })
  table.querySelectorAll<HTMLElement>('[data-table-filter-popover]').forEach(popover => {
    popover.hidden = true
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

  table.querySelectorAll<HTMLElement>('[data-table-sort-button]').forEach(button => {
    button.hidden = mode !== 'sort'
  })
  table.querySelectorAll<HTMLElement>('[data-table-filter-button]').forEach(button => {
    button.hidden = mode !== 'filter'
  })
  if (mode !== 'filter') {
    table.querySelectorAll<HTMLElement>('[data-table-filter-popover]').forEach(popover => {
      popover.hidden = true
    })
  }

  menu.querySelectorAll<HTMLButtonElement>('[data-table-mode-button]').forEach(button => {
    const active = button.dataset.tableModeButton === mode
    button.setAttribute('aria-pressed', String(active))
    button.style.background = active ? '#e2e8f0' : 'rgba(255,255,255,.72)'
    button.style.color = active ? '#0f172a' : '#475569'
  }
  )
}

function updateSortButton (button: HTMLElement): void {
  const direction = button.dataset.tableSortDirection ?? 'none'
  const active = direction !== 'none'
  button.setAttribute('aria-pressed', String(active))
  button.title = direction === 'asc'
    ? '升序（点击切换为降序）'
    : direction === 'desc' ? '降序（点击取消排序）' : '排序（点击切换为升序）'
  button.style.color = active ? '#2563eb' : '#64748b'
  button.style.background = active ? '#dbeafe' : 'rgba(255,255,255,.72)'
}

function toggleFilterPopover (button: HTMLElement): void {
  const wrapper = button.closest<HTMLElement>('[data-table-column-controls]')
  const popover = wrapper?.querySelector<HTMLElement>('[data-table-filter-popover]')
  if (!popover) { return }

  popover.hidden = !popover.hidden
  if (!popover.hidden) {
    popover.querySelector<HTMLInputElement>('[data-table-filter]')?.focus()
  }
}

function cycleSortButton (button: HTMLElement): void {
  const direction = button.dataset.tableSortDirection ?? 'none'
  button.dataset.tableSortDirection = direction === 'none'
    ? 'asc'
    : direction === 'asc' ? 'desc' : 'none'
  updateSortButton(button)
}

function handleTableControlEvent (event: Event): void {
  const eventTarget = event.target
  if (!(eventTarget instanceof Element)) {
    return
  }

  const target = eventTarget.closest<HTMLElement>(
    '[data-table-reset], [data-table-mode-button], [data-table-sort-button], [data-table-filter-button], [data-table-filter]'
  )
  if (!target) { return }

  const menu = target.closest<HTMLElement>('[data-table-controls-menu]')
  const table = target.closest<HTMLTableElement>('table[data-table-controlled]')

  if (target.matches('[data-table-reset]')) {
    if (menu) { resetTable(menu) }
  } else if (target.matches('[data-table-mode-button]')) {
    if (menu) {
      setTableMode(menu, (target as HTMLElement).dataset.tableModeButton as TableMode)
    }
  } else if (target.matches('[data-table-sort-button]')) {
    if (table) {
      cycleSortButton(target as HTMLElement)
      const tableMenu = table.previousElementSibling instanceof HTMLElement && table.previousElementSibling.matches('[data-table-controls-menu]')
        ? table.previousElementSibling
        : null
      if (tableMenu) { updateTable(tableMenu) }
    }
  } else if (target.matches('[data-table-filter-button]')) {
    toggleFilterPopover(target as HTMLElement)
  } else if (target.matches('[data-table-filter]')) {
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
