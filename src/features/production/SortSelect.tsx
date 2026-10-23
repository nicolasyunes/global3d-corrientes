import { useState } from 'react'
import type { QueueSort } from './pieces'

export type ListSort = QueueSort

const LABELS: Record<ListSort, string> = {
  due: 'Entrega más próxima',
  newest: 'Cargados más recientes',
  oldest: 'Cargados más antiguos',
}

function read(key: string): ListSort {
  try {
    const v = localStorage.getItem(key)
    return v === 'newest' || v === 'oldest' ? v : 'due'
  } catch {
    return 'due'
  }
}

// Sort choice remembered per screen.
export function useStoredSort(key: string) {
  const [sort, setSort] = useState<ListSort>(() => read(key))
  function change(next: ListSort) {
    setSort(next)
    try {
      localStorage.setItem(key, next)
    } catch {
      /* preferencia opcional */
    }
  }
  return [sort, change] as const
}

export default function SortSelect({
  value,
  onChange,
}: {
  value: ListSort
  onChange: (next: ListSort) => void
}) {
  return (
    <select
      className="input sort-select"
      aria-label="Ordenar"
      value={value}
      onChange={(e) => onChange(e.target.value as ListSort)}
    >
      {(Object.keys(LABELS) as ListSort[]).map((k) => (
        <option key={k} value={k}>
          {LABELS[k]}
        </option>
      ))}
    </select>
  )
}
