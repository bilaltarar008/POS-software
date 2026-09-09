'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { localDb } from '@/lib/db'
import { isOnline, queueOp } from '@/lib/sync'
import { useSyncStatus } from '@/lib/useSyncStatus'

export default function NewPartyPage() {
  const [name, setName] = useState('')
  const [type, setType] = useState<'customer' | 'supplier' | 'broker'>('customer')
  const [phone, setPhone] = useState('')
  const [brokerageFee, setBrokerageFee] = useState('1.6')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const router = useRouter()
  const pendingCount = useSyncStatus()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const newParty = {
      id: uuidv4(),
      name,
      type,
      phone: phone || null,
      brokerage_fee_percent: type === 'broker' ? parseFloat(brokerageFee) || 1.6 : undefined,
    }

    const online = await isOnline()

    if (online) {
      const { error } = await supabase.from('parties').insert(newParty)
      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
      await localDb.parties.put(newParty)
      router.push('/parties')
    } else {
      await localDb.parties.put(newParty)
      await queueOp('parties', 'insert', newParty)
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
            No internet connection — this {type} was saved on your device and will sync to the cloud automatically once you're back online.
          </p>
        )}
        {pendingCount === 0 && (
          <p className="bg-green-100 text-green-800 p-3 rounded mb-3">
            ✅ Synced! This {type} has been saved to the cloud.
          </p>
        )}
        <a href="/" className="text-blue-600 hover:underline">← Back to Products</a>
      </main>
    )
  }

  return (
    <main className="page-container max-w-sm">
      <h1 className="text-2xl font-bold mb-4">Add Customer / Supplier / Broker</h1>
      <form onSubmit={handleSubmit}>
        <label className="label-text">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'customer' | 'supplier' | 'broker')}
          className="input-field mb-3"
        >
          <option value="customer">Customer</option>
          <option value="supplier">Supplier</option>
          <option value="broker">Broker</option>
        </select>

        <label className="label-text">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="input-field mb-3"
        />

        <label className="label-text">Phone (optional)</label>
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="input-field mb-3"
        />

        {type === 'broker' && (
          <>
            <label className="label-text">Brokerage Fee %</label>
            <input
              type="number"
              step="0.01"
              value={brokerageFee}
              onChange={(e) => setBrokerageFee(e.target.value)}
              className="input-field mb-3"
            />
          </>
        )}

        {error && <p className="text-red-600 mb-3">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </main>
  )
}