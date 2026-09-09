'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { isOnline, queueOp } from '@/lib/sync'
import { useSyncStatus } from '@/lib/useSyncStatus'

export default function NewCapitalPage() {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const router = useRouter()
  const pendingCount = useSyncStatus()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const entry = {
      id: uuidv4(),
      amount: parseFloat(amount),
      note: note || null,
    }

    const online = await isOnline()

    if (online) {
      const { error } = await supabase.from('capital_entries').insert(entry)
      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
      router.push('/dashboard')
    } else {
      await queueOp('capital_entries', 'insert', entry)
      setSavedOffline(true)
      setSaving(false)
    }
  }

  if (savedOffline) {
    return (
      <main className="page-container max-w-sm">
        <h1 className="text-2xl font-bold mb-4">Saved Offline</h1>
        {pendingCount !== null && pendingCount > 0 && (
          <p className="bg-amber-100 text-amber-800 p-3 rounded mb-3">
            No internet connection — this capital entry was saved on your device and will sync to the cloud automatically once you're back online.
          </p>
        )}
        {pendingCount === 0 && (
          <p className="bg-green-100 text-green-800 p-3 rounded mb-3">
            ✅ Synced! This capital entry has been saved to the cloud.
          </p>
        )}
        <a href="/" className="text-blue-600 hover:underline">← Back to Products</a>
      </main>
    )
  }

  return (
    <main className="page-container max-w-sm">
      <h1 className="text-2xl font-bold mb-4">Record Capital</h1>
      <p className="text-gray-600 mb-4 text-sm">
        Log money you're putting into the business (e.g. monthly investment).
      </p>
      <form onSubmit={handleSubmit}>
        <label className="label-text">Amount</label>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="input-field mb-3"
        />

        <label className="label-text">Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. September investment"
          className="input-field mb-3"
        />

        {error && <p className="text-red-600 mb-3">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </main>
  )
}