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

function filterPopovers (table: HTMLTableElement): HTMLElement[] {
  return Array.from(table.querySelectorAll<HTMLElement>('[data-table-filter-popover]'))
    .filter(popover => popover.dataset.tableInitialized === 'true')
}

function updateFilterSummary (popover: HTMLElement): void {
  const options = Array.from(popover.querySelectorAll<HTMLInputElement>('[data-table-filter-option]'))
  const selected = options.filter(option => option.checked).length
  const selectAll = popover.querySelector<HTMLInputElement>('[data-table-select-all]')
  const count = popover.querySelector<HTMLElement>('[data-table-filter-count]')
  if (selectAll) {
    selectAll.checked = options.length > 0 && selected === options.length
    selectAll.indeterminate = selected > 0 && selected < options.length
  }
  if (count) { count.textContent = '（' + options.length + '）' }
}

function populateFilterPopover (button: HTMLElement): void {
  const table = button.closest<HTMLTableElement>('table[data-table-controlled]')
  const wrapper = button.closest<HTMLElement>('[data-table-column-controls]')
  const popover = wrapper?.querySelector<HTMLElement>('[data-table-filter-popover]')
  const values = popover?.querySelector<HTMLElement>('[data-table-filter-values]')
  if (!table || !popover || !values || popover.dataset.tableInitialized === 'true') { return }

  const column = Number(button.dataset.tableColumn ?? 0)
  const counts = new Map<string, number>()
  const body = table.tBodies[0]
  const rows = body ? Array.from(body.rows) : []
  for (const row of rows) {
    const value = row.cells[column]?.textContent?.trim() ?? ''
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  const doc = table.ownerDocument
  values.replaceChildren()
  Array.from(counts.entries()).forEach(([value, count], index) => {
    const label = doc.createElement('label')
    label.dataset.tableFilterExtra = String(index >= 10)
    label.style.cssText = 'display:flex;align-items:center;gap:7px;padding:2px 0;color:#334155;font:500 14px/1.35 system-ui,sans-serif;cursor:pointer;'

    const checkbox = doc.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = true
    checkbox.dataset.tableFilterOption = ''
    checkbox.dataset.tableValue = value
    checkbox.dataset.tableValueCount = String(count)
    checkbox.style.cssText = 'width:17px;height:17px;margin:0;accent-color:#39b58d;cursor:pointer;'

    const valueText = doc.createElement('span')
    valueText.textContent = value || '（空白）'
    valueText.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'

    const countText = doc.createElement('span')
    countText.textContent = '（' + count + '）'
    countText.style.cssText = 'color:#94a3b8;'

    label.append(checkbox, valueText, countText)
    values.append(label)
  })

  popover.dataset.tableInitialized = 'true'
  popover.dataset.tableColumn = String(column)
  const more = popover.querySelector<HTMLButtonElement>('[data-table-filter-more]')
  if (more) { more.hidden = counts.size <= 10 }
  values.querySelectorAll<HTMLElement>('[data-table-filter-extra="true"]').forEach(option => { option.hidden = true })
  updateFilterSummary(popover)
}

function filterStates (table: HTMLTableElement): Array<{ column: number, values: Set<string> }> {
  return filterPopovers(table).map(popover => ({
    column: Number(popover.dataset.tableColumn ?? 0),
    values: new Set(Array.from(popover.querySelectorAll<HTMLInputElement>('[data-table-filter-option]'))
      .filter(option => option.checked)
      .map(option => option.dataset.tableValue ?? ''))
  }))
}

function updateTable (menu: HTMLElement): void {
  const table = tableForMenu(menu)
  if (!table) { return }
  const body = table.tBodies[0]
  if (!body) { return }

  const filters = filterStates(table)
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
    const visible = filters.every(filter => filter.values.has(row.cells[filter.column]?.textContent?.trim() ?? ''))

    row.hidden = !visible
    if (visible) { visibleRows++ }
    body.append(row)
  }

  table.querySelectorAll<HTMLElement>('[data-table-filter-button]').forEach(button => {
    const popover = button.closest<HTMLElement>('[data-table-column-controls]')?.querySelector<HTMLElement>('[data-table-filter-popover]')
    const active = Boolean(popover && filterPopovers(table).includes(popover) &&
      Array.from(popover.querySelectorAll<HTMLInputElement>('[data-table-filter-option]')).some(option => !option.checked))
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

  table.querySelectorAll<HTMLInputElement>('[data-table-filter-option]').forEach(control => { control.checked = true })
  table.querySelectorAll<HTMLElement>('[data-table-sort-button]').forEach(button => {
    button.dataset.tableSortDirection = 'none'
    updateSortButton(button)
  })
  table.querySelectorAll<HTMLElement>('[data-table-filter-popover]').forEach(popover => {
    popover.hidden = true
  })
  filterPopovers(table).forEach(updateFilterSummary)
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
  populateFilterPopover(button)
  const wrapper = button.closest<HTMLElement>('[data-table-column-controls]')
  const popover = wrapper?.querySelector<HTMLElement>('[data-table-filter-popover]')
  if (!popover) { return }

  popover.hidden = !popover.hidden
}

function cycleSortButton (button: HTMLElement): void {
  const direction = button.dataset.tableSortDirection ?? 'none'
  button.dataset.tableSortDirection = direction === 'none'
    ? 'asc'
    : direction === 'asc' ? 'desc' : 'none'
  updateSortButton(button)
}

function setFilterOptions (popover: HTMLElement, predicate: (option: HTMLInputElement, index: number) => boolean): void {
  popover.querySelectorAll<HTMLInputElement>('[data-table-filter-option]').forEach((option, index) => {
    option.checked = predicate(option, index)
  })
  updateFilterSummary(popover)
}

function handleFilterAction (target: HTMLElement, menu: HTMLElement): void {
  const popover = target.closest<HTMLElement>('[data-table-filter-popover]')
  if (target.matches('[data-table-select-all]') && popover) {
    setFilterOptions(popover, () => (target as HTMLInputElement).checked)
  } else if (target.matches('[data-table-filter-option]') && popover) {
    updateFilterSummary(popover)
  } else if (target.matches('[data-table-filter-invert]') && popover) {
    setFilterOptions(popover, option => !option.checked)
  } else if (target.matches('[data-table-filter-duplicates]') && popover) {
    setFilterOptions(popover, option => Number(option.dataset.tableValueCount ?? 0) > 1)
  } else if (target.matches('[data-table-filter-top]') && popover) {
    setFilterOptions(popover, (_option, index) => index < 10)
  } else if (target.matches('[data-table-filter-more]') && popover) {
    const extras = popover.querySelectorAll<HTMLElement>('[data-table-filter-extra="true"]')
    const opening = Array.from(extras).some(option => option.hidden)
    extras.forEach(option => { option.hidden = !opening })
    target.textContent = opening ? '收起' : '更多'
    return
  }
  updateTable(menu)
}

function handleTableControlEvent (event: Event): void {
  const eventTarget = event.target
  if (!(eventTarget instanceof Element)) {
    return
  }

  const target = eventTarget.closest<HTMLElement>(
    '[data-table-reset], [data-table-mode-button], [data-table-sort-button], [data-table-filter-button], [data-table-select-all], [data-table-filter-option], [data-table-filter-invert], [data-table-filter-duplicates], [data-table-filter-top], [data-table-filter-more]'
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
  } else if (table && target.matches('[data-table-select-all], [data-table-filter-option], [data-table-filter-invert], [data-table-filter-duplicates], [data-table-filter-top], [data-table-filter-more]')) {
    const tableMenu = table.previousElementSibling instanceof HTMLElement && table.previousElementSibling.matches('[data-table-controls-menu]')
      ? table.previousElementSibling
      : null
    if (tableMenu) { handleFilterAction(target, tableMenu) }
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
