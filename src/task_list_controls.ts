const installedDocuments = new WeakSet<Document>()

type TaskFilter = 'all' | 'pending' | 'completed'
type TaskSort = 'original' | 'pending-first' | 'completed-first'
type TaskStatus = 'pending' | 'completed' | 'other'

function directItems (list: HTMLElement): HTMLElement[] {
  return Array.from(list.children).filter((child): child is HTMLElement => (
    child instanceof HTMLElement && child.tagName === 'LI'
  ))
}

function statusRank (status: TaskStatus, sort: TaskSort): number {
  if (sort === 'pending-first') {
    return status === 'pending' ? 0 : status === 'completed' ? 1 : 2
  }
  if (sort === 'completed-first') {
    return status === 'completed' ? 0 : status === 'pending' ? 1 : 2
  }
  return 0
}

function updateTaskList (menu: HTMLElement): void {
  const list = menu.nextElementSibling
  if (!(list instanceof HTMLElement) || !list.matches('ol[data-task-list], ul[data-task-list]')) {
    return
  }

  const filterControl = menu.querySelector<HTMLSelectElement>('[data-task-list-filter]')
  const sortControl = menu.querySelector<HTMLSelectElement>('[data-task-list-sort]')
  const summary = menu.querySelector<HTMLElement>('[data-task-list-summary]')
  const filter = (filterControl?.value ?? 'all') as TaskFilter
  const sort = (sortControl?.value ?? 'original') as TaskSort
  const items = directItems(list)

  items.sort((left, right) => {
    const leftIndex = Number(left.dataset.taskIndex ?? 0)
    const rightIndex = Number(right.dataset.taskIndex ?? 0)
    if (sort === 'original') { return leftIndex - rightIndex }

    const leftStatus = (left.dataset.taskStatus ?? 'other') as TaskStatus
    const rightStatus = (right.dataset.taskStatus ?? 'other') as TaskStatus
    return statusRank(leftStatus, sort) - statusRank(rightStatus, sort) || leftIndex - rightIndex
  })

  let visibleTasks = 0
  let totalTasks = 0
  let pendingTasks = 0

  for (const item of items) {
    const status = (item.dataset.taskStatus ?? 'other') as TaskStatus
    const isTask = status === 'pending' || status === 'completed'
    const visible = filter === 'all' || status === filter

    if (isTask) {
      totalTasks++
      if (status === 'pending') { pendingTasks++ }
      if (visible) { visibleTasks++ }
    }

    item.hidden = !visible
    list.append(item)
  }

  if (summary) {
    summary.textContent = filter === 'all'
      ? `共 ${totalTasks} 项 · ${pendingTasks} 项未完成`
      : `显示 ${visibleTasks} / ${totalTasks} 项`
  }
}

function handleTaskListChange (event: Event): void {
  const target = event.target
  if (!(target instanceof Element) ||
      !target.matches('[data-task-list-filter], [data-task-list-sort]')) {
    return
  }

  const menu = target.closest<HTMLElement>('[data-task-list-menu]')
  if (menu) { updateTaskList(menu) }
}

function installTaskListControls (doc: Document): void {
  if (installedDocuments.has(doc)) { return }
  doc.addEventListener('change', handleTaskListChange)
  installedDocuments.add(doc)
}

if (typeof document !== 'undefined') {
  installTaskListControls(document)
}

export {}
