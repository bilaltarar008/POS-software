'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function NewPaymentPage() {
  const [parties, setParties] = useState<any[]>([])
  const [partyId, setPartyId] = useState('')
  const [direction, setDirection] = useState<'received' | 'made'>('received')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchParties = async () => {
      const { data } = await supabase.from('parties').select('id, name, type').order('name')
      setParties(data || [])
    }
    fetchParties()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const amt = parseFloat(amount)
    // Received = money coming in = reduces what they owe you = negative entry
    // Made = money going out = reduces what you owe them = negative entry
    // Both directions reduce a balance, so both are stored negative.
    const { error } = await supabase.from('ledger_entries').insert({
      party_id: partyId,
      entry_type: direction === 'received' ? 'payment_received' : 'payment_made',
      amount: -amt,
      note: note || null,
    })

    if (error) {
      setError(error.message)
      setSaving(false)
    } else {
      router.push('/')
    }
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 400 }}>
      <h1>Record Payment</h1>
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 4 }}>Party</label>
        <select
          value={partyId}
          onChange={(e) => setPartyId(e.target.value)}
          required
          style={{ display: 'block', marginBottom: 12, width: '100%', padding: 8 }}
        >
          <option value="">Select a party</option>
          {parties.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
          ))}
        </select>

        <label style={{ display: 'block', marginBottom: 4 }}>Direction</label>
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as 'received' | 'made')}
          style={{ display: 'block', marginBottom: 12, width: '100%', padding: 8 }}
        >
          <option value="received">Payment Received (they paid you)</option>
          <option value="made">Payment Made (you paid them)</option>
        </select>

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
          style={{ display: 'block', marginBottom: 12, width: '100%', padding: 8 }}
        />

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit" disabled={saving} style={{ padding: '8px 16px' }}>
          {saving ? 'Saving...' : 'Save Payment'}
        </button>
      </form>
    </main>
  )
}