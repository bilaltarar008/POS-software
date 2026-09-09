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
          supabase.from('ledger_entries').select('*').eq('party_id', id).order('created_at', { ascending: true })
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

  if (loading) return <main className="page-container">Loading...</main>
  if (!party) return <main className="page-container">Party not found{offline ? ' (and you are offline)' : ''}</main>

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
    <main className="page-container">
      {offline && (
        <p className="bg-amber-100 text-amber-800 p-2 rounded mb-4 text-sm">
          ⚠️ You're offline. Showing last saved data.
        </p>
      )}
      <Link href="/parties" className="text-blue-600 hover:underline">← Back to Balances</Link>
      <h1 className="text-2xl font-bold mt-2">{party.name}</h1>
      <p className="text-gray-600 capitalize">{party.type}{party.phone ? ` · ${party.phone}` : ''}</p>

      <div className="mt-4 p-4 bg-gray-100 rounded-lg inline-block">
        <p className="m-0 text-sm">Current Balance</p>
        <h2 className={`m-0 text-xl font-bold ${runningBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
          Rs. {Math.abs(runningBalance).toFixed(2)}
          {runningBalance > 0
            ? party.type === 'customer' ? ' (they owe you)' : ' (you owe them)'
            : runningBalance < 0 ? ' (credit balance)' : ''}
        </h2>
      </div>

      <h2 className="text-lg font-semibold mt-8">Transaction History</h2>
      {rows.length === 0 && <p className="text-gray-600">No transactions yet.</p>}
      <div className="overflow-x-auto mt-2">
        <table className="table-base">
          <thead>
            <tr>
              <th>Type</th>
              <th>Note</th>
              <th>Amount</th>
              <th>Running Balance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{labelFor(row.entry_type)}</td>
                <td>{row.note || '—'}</td>
                <td className={Number(row.amount) > 0 ? 'text-red-600' : 'text-green-600'}>
                  {Number(row.amount) > 0 ? '+' : ''}Rs. {Number(row.amount).toFixed(2)}
                </td>
                <td>Rs. {row.runningBalance.toFixed(2)}</td>
                <td>
                  {row.invoice_id && <Link href={`/invoices/${row.invoice_id}`} className="text-blue-600 hover:underline">View Invoice</Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}