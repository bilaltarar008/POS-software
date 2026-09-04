'use client'

import { useEffect, useState } from 'react'
import { localDb } from '@/lib/db'
import { isOnline, flushPendingOps } from '@/lib/sync'

export default function SyncManager() {
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncMessage, setLastSyncMessage] = useState('')

  const refreshPendingCount = async () => {
    const count = await localDb.pending_ops.count()
    setPendingCount(count)
  }

  const trySync = async () => {
    const online = await isOnline()
    if (!online) return

    const count = await localDb.pending_ops.count()
    if (count === 0) return

    setSyncing(true)
    const { synced, failed } = await flushPendingOps()
    setSyncing(false)

    if (synced > 0) {
      setLastSyncMessage(`Synced ${synced} item(s) to the cloud`)
      setTimeout(() => setLastSyncMessage(''), 4000)
    }
    if (failed > 0) {
      setLastSyncMessage(`${failed} item(s) failed to sync, will retry`)
    }

    await refreshPendingCount()
  }

  useEffect(() => {
    refreshPendingCount()

    // Try syncing right when the app loads
    trySync()

    // Try syncing whenever the browser reports coming back online
    const handleOnline = () => trySync()
    window.addEventListener('online', handleOnline)

    // Also poll periodically in case 'online' event doesn't fire reliably
    const interval = setInterval(trySync, 15000)

    return () => {
      window.removeEventListener('online', handleOnline)
      clearInterval(interval)
    }
  }, [])

  if (pendingCount === 0 && !lastSyncMessage) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        padding: '10px 16px',
        borderRadius: 8,
        background: syncing ? '#dbeafe' : pendingCount > 0 ? '#fef3c7' : '#dcfce7',
        border: '1px solid #ccc',
        fontSize: 14,
        zIndex: 1000,
      }}
    >
      {syncing && 'Syncing...'}
      {!syncing && pendingCount > 0 && `${pendingCount} item(s) waiting to sync`}
      {!syncing && pendingCount === 0 && lastSyncMessage}
    </div>
  )
}