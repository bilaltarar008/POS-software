'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { localDb } from '@/lib/db'
import { withTimeout } from '@/lib/sync'

export default function PartyStatementPage() {
  const { id } = useParams()
  const [party, setParty] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: partyData, error: partyError } = await withTimeout(
          supabase.from('parties').select('*').eq('id', id).single()
        )
        if (partyError) throw partyError

        const { data: entryData, error: entryError } = await withTimeout(
          supabase
            .from('ledger_entries')
            .select('*')
            .eq('party_id', id)
            .order('created_at', { ascending: true })
        )
        if (entryError) throw entryError

        setParty(partyData)
        setEntries(entryData || [])
        setOffline(false)

        await localDb.parties.put(partyData)
        await localDb.ledger_entries.bulkPut(entryData || [])
      } catch {
        setOffline(true)
        const cachedParty = await localDb.parties.get(id as string)
        const cachedEntries = await localDb.ledger_entries.where('party_id').equals(id as string).toArray()
        setParty(cachedParty)
        setEntries(cachedEntries.sort((a, b) => a.id.localeCompare(b.id)))
      }
      setLoading(false)
    }
    fetchData()
  }, [id])

  if (loading) return <main style={{ padding: '2rem' }}>Loading...</main>
  if (!party) return <main style={{ padding: '2rem' }}>Party not found{offline ? ' (and you are offline)' : ''}</main>

  // Running balance, computed in order
  let runningBalance = 0
  const rows = entries.map((e) => {
    runningBalance += Number(e.amount)
    return { ...e, runningBalance }
  })

  const labelFor = (entryType: string) => {
    switch (entryType) {
      case 'sale': return 'Sale (Invoice)'
      case 'purchase': return 'Purchase / Brokerage'
      case 'payment_received': return 'Payment Received'
      case 'payment_made': return 'Payment Made'
      default: return entryType
    }
  }

  return (
    <main style={{ padding: '2rem' }}>
      {offline && (
        <p style={{ background: '#fef3c7', padding: 8, borderRadius: 4, marginBottom: 16 }}>
          ⚠️ You're offline. Showing last saved data.
        </p>
      )}
      <Link href="/parties">← Back to Balances</Link>
      <h1 style={{ marginTop: 8 }}>{party.name}</h1>
      <p style={{ color: '#666', textTransform: 'capitalize' }}>{party.type}{party.phone ? ` · ${party.phone}` : ''}</p>

      <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 8, display: 'inline-block' }}>
        <p style={{ margin: 0 }}>Current Balance</p>
        <h2 style={{ margin: 0, color: runningBalance > 0 ? '#dc2626' : '#16a34a' }}>
          Rs. {Math.abs(runningBalance).toFixed(2)}
          {runningBalance > 0
            ? party.type === 'customer' ? ' (they owe you)' : ' (you owe them)'
            : runningBalance < 0 ? ' (credit balance)' : ''}
        </h2>
      </div>

      <h2 style={{ marginTop: 32 }}>Transaction History</h2>
      {rows.length === 0 && <p>No transactions yet.</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th>Type</th>
            <th>Note</th>
            <th>Amount</th>
            <th>Running Balance</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
              <td>{labelFor(row.entry_type)}</td>
              <td>{row.note || '—'}</td>
              <td style={{ color: Number(row.amount) > 0 ? '#dc2626' : '#16a34a' }}>
                {Number(row.amount) > 0 ? '+' : ''}Rs. {Number(row.amount).toFixed(2)}
              </td>
              <td>Rs. {row.runningBalance.toFixed(2)}</td>
              <td>
                {row.invoice_id && <Link href={`/invoices/${row.invoice_id}`}>View Invoice</Link>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}