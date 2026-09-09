import { useEffect, useState } from 'react'
import { localDb } from './db'

export function useSyncStatus() {
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const count = await localDb.pending_ops.count()
      if (!cancelled) setPendingCount(count)
    }

    check()
    const interval = setInterval(check, 3000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return pendingCount
}