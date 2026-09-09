'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { localDb } from '@/lib/db'
import { isOnline, queueOp, withTimeout } from '@/lib/sync'
import { useSyncStatus } from '@/lib/useSyncStatus'

export default function NewPaymentPage() {
  const [parties, setParties] = useState<any[]>([])
  const [partyId, setPartyId] = useState('')
  const [direction, setDirection] = useState<'received' | 'made'>('received')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const router = useRouter()
  const pendingCount = useSyncStatus()

  useEffect(() => {
    const fetchParties = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.from('parties').select('id, name, type').order('name')
        )
        if (error) throw error
        setParties(data || [])
        await localDb.parties.bulkPut(data || [])
      } catch {
        const cached = await localDb.parties.toArray()
        setParties(cached)
      }
    }
    fetchParties()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const amt = parseFloat(amount)
    const entry = {
      id: uuidv4(),
      party_id: partyId,
      entry_type: direction === 'received' ? 'payment_received' : 'payment_made',
      amount: -amt,
      note: note || null,
    }

    const online = await isOnline()

    if (online) {
      const { error } = await supabase.from('ledger_entries').insert(entry)
      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
      router.push('/')
    } else {
      await queueOp('ledger_entries', 'insert', entry)
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
            No internet connection — this payment was saved on your device and will sync to the cloud automatically once you're back online.
          </p>
        )}
        {pendingCount === 0 && (
          <p className="bg-green-100 text-green-800 p-3 rounded mb-3">
            ✅ Synced! This payment has been saved to the cloud.
          </p>
        )}
        <a href="/" className="text-blue-600 hover:underline">← Back to Products</a>
      </main>
    )
  }

  return (
    <main className="page-container max-w-sm">
      <h1 className="text-2xl font-bold mb-4">Record Payment</h1>
      <form onSubmit={handleSubmit}>
        <label className="label-text">Party</label>
        <select
          value={partyId}
          onChange={(e) => setPartyId(e.target.value)}
          required
          className="input-field mb-3"
        >
          <option value="">Select a party</option>
          {parties.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
          ))}
        </select>

        <label className="label-text">Direction</label>
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as 'received' | 'made')}
          className="input-field mb-3"
        >
          <option value="received">Payment Received (they paid you)</option>
          <option value="made">Payment Made (you paid them)</option>
        </select>

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
          className="input-field mb-3"
        />

        {error && <p className="text-red-600 mb-3">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Payment'}
        </button>
      </form>
    </main>
  )
}