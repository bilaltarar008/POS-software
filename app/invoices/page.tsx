'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { localDb } from '@/lib/db'
import { withTimeout } from '@/lib/sync'

export default function InvoicesListPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('invoices')
            .select('*, parties!invoices_party_id_fkey(name)')
            .order('invoice_date', { ascending: false })
        )
        if (error) throw error

        setInvoices(data || [])
        setOffline(false)

        await localDb.invoices.bulkPut(
          (data || []).map((inv: any) => ({
            id: inv.id,
            party_id: inv.party_id,
            broker_id: inv.broker_id,
            invoice_date: inv.invoice_date,
            total: inv.total,
            amount_paid: inv.amount_paid,
            brokerage_amount: inv.brokerage_amount,
            party_name: inv.parties?.name,
          }))
        )
      } catch {
        setOffline(true)
        const cached = await localDb.invoices.toArray()
        const sorted = cached.sort((a, b) => (a.invoice_date < b.invoice_date ? 1 : -1))
        setInvoices(
          sorted.map((inv) => ({ ...inv, parties: { name: inv.party_name } }))
        )
      }
      setLoading(false)
    }
    fetchInvoices()
  }, [])

  if (loading) return <main style={{ padding: '2rem' }}>Loading...</main>

  return (
    <main style={{ padding: '2rem' }}>
      {offline && (
        <p style={{ background: '#fef3c7', padding: 8, borderRadius: 4, marginBottom: 16 }}>
          ⚠️ You're offline. Showing last saved data.
        </p>
      )}
      <h1>All Invoices</h1>
      <Link
        href="/invoices/new"
        style={{ display: 'inline-block', marginBottom: 16, padding: '8px 16px', background: '#0070f3', color: 'white', textDecoration: 'none', borderRadius: 4 }}
      >
        + New Invoice
      </Link>
      {invoices.length === 0 && <p>No invoices yet.</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th>Date</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Paid</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const balanceDue = inv.total - inv.amount_paid
            const status = balanceDue <= 0 ? 'Paid' : inv.amount_paid > 0 ? 'Partially Paid' : 'On Credit'
            const statusColor = balanceDue <= 0 ? '#16a34a' : inv.amount_paid > 0 ? '#d97706' : '#dc2626'

            return (
              <tr key={inv.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{inv.invoice_date}</td>
                <td>{inv.parties?.name}</td>
                <td>Rs. {inv.total}</td>
                <td>Rs. {inv.amount_paid}</td>
                <td style={{ color: statusColor, fontWeight: 'bold' }}>{status}</td>
                <td><Link href={`/invoices/${inv.id}`}>View</Link></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </main>
  )
}