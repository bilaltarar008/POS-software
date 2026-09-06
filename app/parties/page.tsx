'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { localDb } from '@/lib/db'
import { withTimeout } from '@/lib/sync'

export default function PartiesPage() {
  const [balances, setBalances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const { data: parties, error: partiesError } = await withTimeout(
          supabase.from('parties').select('id, name, type')
        )
        if (partiesError) throw partiesError

        const { data: entries, error: entriesError } = await withTimeout(
          supabase.from('ledger_entries').select('id, party_id, invoice_id, entry_type, amount, note')
        )
        if (entriesError) throw entriesError

        setOffline(false)

        // Cache both for offline use
        await localDb.parties.bulkPut(parties || [])
        await localDb.ledger_entries.bulkPut(entries || [])

        computeBalances(parties || [], entries || [])
      } catch {
        setOffline(true)
        const parties = await localDb.parties.toArray()
        const entries = await localDb.ledger_entries.toArray()
        computeBalances(parties, entries)
      }
      setLoading(false)
    }

    const computeBalances = (parties: any[], entries: any[]) => {
      const balanceMap: Record<string, number> = {}
      entries.forEach((e) => {
        balanceMap[e.party_id] = (balanceMap[e.party_id] || 0) + Number(e.amount)
      })

      const result = parties.map((p) => ({
        ...p,
        balance: balanceMap[p.id] || 0,
      }))

      setBalances(result)
    }

    fetchBalances()
  }, [])

  if (loading) return <main style={{ padding: '2rem' }}>Loading...</main>

  const owedToYou = balances.filter((b) => b.type === 'customer' && b.balance > 0)
  const youOwe = balances.filter((b) => (b.type === 'supplier' || b.type === 'broker') && b.balance > 0)

  return (
    <main style={{ padding: '2rem' }}>
      {offline && (
        <p style={{ background: '#fef3c7', padding: 8, borderRadius: 4, marginBottom: 16 }}>
          ⚠️ You're offline. Showing last saved data.
        </p>
      )}
      <h1>Party Balances</h1>

      <h2 style={{ color: '#16a34a' }}>Owed to You</h2>
      {owedToYou.length === 0 && <p>Nobody owes you right now.</p>}
      <ul>
        {owedToYou.map((b) => (
          <li key={b.id}>{b.name}: Rs. {b.balance.toFixed(2)}</li>
        ))}
      </ul>

      <h2 style={{ color: '#dc2626', marginTop: 24 }}>You Owe</h2>
      {youOwe.length === 0 && <p>You don't owe anyone right now.</p>}
      <ul>
        {youOwe.map((b) => (
          <li key={b.id}>{b.name}: Rs. {b.balance.toFixed(2)}</li>
        ))}
      </ul>
    </main>
  )
}