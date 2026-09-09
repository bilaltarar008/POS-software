'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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

      const result = parties.map((p) => ({ ...p, balance: balanceMap[p.id] || 0 }))
      setBalances(result)
    }

    fetchBalances()
  }, [])

  if (loading) return <main className="page-container">Loading...</main>

  const owedToYou = balances.filter((b) => b.type === 'customer' && b.balance > 0)
  const youOwe = balances.filter((b) => (b.type === 'supplier' || b.type === 'broker') && b.balance > 0)

  return (
    <main className="page-container">
      {offline && (
        <p className="bg-amber-100 text-amber-800 p-2 rounded mb-4 text-sm">
          ⚠️ You're offline. Showing last saved data.
        </p>
      )}
      <h1 className="text-2xl font-bold mb-4">Party Balances</h1>
      <Link href="/parties/new" className="btn-primary mb-6 inline-block">
        + Add Customer / Supplier / Broker
      </Link>

      <h2 className="text-lg font-semibold text-green-600 mt-4">Owed to You</h2>
      {owedToYou.length === 0 && <p className="text-gray-600">Nobody owes you right now.</p>}
      <ul className="mt-2 space-y-1">
        {owedToYou.map((b) => (
          <li key={b.id}>
            <Link href={`/parties/${b.id}`} className="text-blue-600 hover:underline">{b.name}</Link>: Rs. {b.balance.toFixed(2)}
          </li>
        ))}
      </ul>

      <h2 className="text-lg font-semibold text-red-600 mt-6">You Owe</h2>
      {youOwe.length === 0 && <p className="text-gray-600">You don't owe anyone right now.</p>}
      <ul className="mt-2 space-y-1">
        {youOwe.map((b) => (
          <li key={b.id}>
            <Link href={`/parties/${b.id}`} className="text-blue-600 hover:underline">{b.name}</Link>: Rs. {b.balance.toFixed(2)}
          </li>
        ))}
      </ul>
    </main>
  )
}