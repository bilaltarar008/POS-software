'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { isOnline, queueOp } from '@/lib/sync'

export default function NewCapitalPage() {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const router = useRouter()

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
      <main style={{ padding: '2rem', maxWidth: 400 }}>
        <h1>Saved Offline</h1>
        <p style={{ background: '#fef3c7', padding: 12, borderRadius: 4 }}>
          No internet connection — this capital entry was saved on your device and will sync to the cloud automatically once you're back online.
        </p>
        <a href="/">← Back to Products</a>
      </main>
    )
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 400 }}>
      <h1>Record Capital</h1>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Log money you're putting into the business (e.g. monthly investment).
      </p>
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 4 }}>Amount</label>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          style={{ display: 'block', marginBottom: 12, width: '100%', padding: 8 }}
        />

        <label style={{ display: 'block', marginBottom: 4 }}>Note (optional)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. September investment"
          style={{ display: 'block', marginBottom: 12, width: '100%', padding: 8 }}
        />

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit" disabled={saving} style={{ padding: '8px 16px' }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </main>
  )
}