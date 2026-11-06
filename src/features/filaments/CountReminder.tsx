import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOperator } from '@/features/operators/operator-context'
import { countReminder, reminderText, type CountReminderInfo } from './count'
import { listCountStatus } from './stockCount.api'
import './count.css'

// "Hace 9 días que no se cuenta el estante": silent if it cannot load.
export default function CountReminder({
  reloadKey = 0,
  showLink = true,
}: {
  reloadKey?: number
  showLink?: boolean
}) {
  const { isAdmin } = useOperator()
  const [info, setInfo] = useState<CountReminderInfo | null>(null)

  useEffect(() => {
    let alive = true
    listCountStatus()
      .then((rows) => alive && setInfo(countReminder(rows, new Date())))
      .catch(() => alive && setInfo(null))
    return () => {
      alive = false
    }
  }, [reloadKey])

  const text = info ? reminderText(info, isAdmin) : null
  if (!text) return null
  return (
    <p className="ct-reminder" role="status">
      <span>{text}</span>
      {showLink && <Link to="/admin/conteo">Ir al conteo</Link>}
    </p>
  )
}
