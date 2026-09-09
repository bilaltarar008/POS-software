'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { localDb } from '@/lib/db'
import { isOnline, queueOp } from '@/lib/sync'

export default function NewPartyPage() {
  const [name, setName] = useState('')
  const [type, setType] = useState<'customer' | 'supplier' | 'broker'>('customer')
  const [phone, setPhone] = useState('')
  const [brokerageFee, setBrokerageFee] = useState('1.6')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const router = useRouter()

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
      <main style={{ padding: '2rem', maxWidth: 400 }}>
        <h1>Saved Offline</h1>
        <p style={{ background: '#fef3c7', padding: 12, borderRadius: 4 }}>
          No internet connection — this {type} was saved on your device and will sync to the cloud automatically once you're back online.
        </p>
        <a href="/">← Back to Products</a>
      </main>
    )
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 400 }}>
      <h1>Add Customer / Supplier / Broker</h1>
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 4 }}>Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'customer' | 'supplier' | 'broker')}
          style={{ display: 'block', marginBottom: 12, width: '100%', padding: 8 }}
        >
          <option value="customer">Customer</option>
          <option value="supplier">Supplier</option>
          <option value="broker">Broker</option>
        </select>

        <label style={{ display: 'block', marginBottom: 4 }}>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ display: 'block', marginBottom: 12, width: '100%', padding: 8 }}
        />

        <label style={{ display: 'block', marginBottom: 4 }}>Phone (optional)</label>
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ display: 'block', marginBottom: 12, width: '100%', padding: 8 }}
        />

        {type === 'broker' && (
          <>
            <label style={{ display: 'block', marginBottom: 4 }}>Brokerage Fee %</label>
            <input
              type="number"
              step="0.01"
              value={brokerageFee}
              onChange={(e) => setBrokerageFee(e.target.value)}
              style={{ display: 'block', marginBottom: 12, width: '100%', padding: 8 }}
            />
          </>
        )}

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit" disabled={saving} style={{ padding: '8px 16px' }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </main>
  )
}