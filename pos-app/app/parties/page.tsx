'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function PartiesPage() {
  const [balances, setBalances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBalances = async () => {
      const { data: parties } = await supabase.from('parties').select('id, name, type')
      const { data: entries } = await supabase.from('ledger_entries').select('party_id, amount')

      const balanceMap: Record<string, number> = {}
      entries?.forEach((e) => {
        balanceMap[e.party_id] = (balanceMap[e.party_id] || 0) + Number(e.amount)
      })

      const result = (parties || []).map((p) => ({
        ...p,
        balance: balanceMap[p.id] || 0,
      }))

      setBalances(result)
      setLoading(false)
    }
    fetchBalances()
  }, [])

  if (loading) return <main style={{ padding: '2rem' }}>Loading...</main>

  const owedToYou = balances.filter((b) => b.type === 'customer' && b.balance > 0)
  const youOwe = balances.filter((b) => b.type === 'supplier' && b.balance > 0)

  return (
    <main style={{ padding: '2rem' }}>
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