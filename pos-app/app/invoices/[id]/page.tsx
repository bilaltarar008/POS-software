'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { localDb } from '@/lib/db'

export default function InvoiceViewPage() {
  const { id } = useParams()
  const [invoice, setInvoice] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .select('*, parties!invoices_party_id_fkey(name), broker:parties!invoices_broker_id_fkey(name)')
          .eq('id', id)
          .single()
        if (invoiceError) throw invoiceError

        const { data: itemData, error: itemsError } = await supabase
          .from('invoice_items')
          .select('*, products(name)')
          .eq('invoice_id', id)
        if (itemsError) throw itemsError

        setInvoice(invoiceData)
        setItems(itemData || [])
        setOffline(false)

        // Cache everything for offline viewing later
        await localDb.invoices.put({
          id: invoiceData.id,
          party_id: invoiceData.party_id,
          broker_id: invoiceData.broker_id,
          invoice_date: invoiceData.invoice_date,
          total: invoiceData.total,
          amount_paid: invoiceData.amount_paid,
          brokerage_amount: invoiceData.brokerage_amount,
          party_name: invoiceData.parties?.name,
          broker_name: invoiceData.broker?.name,
        })

        await localDb.invoice_items.bulkPut(
          (itemData || []).map((item: any) => ({
            id: item.id,
            invoice_id: item.invoice_id,
            product_id: item.product_id,
            weight_kg: item.weight_kg,
            rate_per_maund: item.rate_per_maund,
            line_total: item.line_total,
            cost_per_maund: item.cost_per_maund,
            product_name: item.products?.name,
          }))
        )
      } catch {
        // Offline or fetch failed — read from local cache instead
        setOffline(true)
        const cachedInvoice = await localDb.invoices.get(id as string)
        const cachedItems = await localDb.invoice_items.where('invoice_id').equals(id as string).toArray()

        if (cachedInvoice) {
          setInvoice({
            ...cachedInvoice,
            parties: { name: cachedInvoice.party_name },
            broker: { name: cachedInvoice.broker_name },
          })
          setItems(
            cachedItems.map((item) => ({ ...item, products: { name: item.product_name } }))
          )
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [id])

  if (loading) return <main style={{ padding: '2rem' }}>Loading...</main>
  if (!invoice) return <main style={{ padding: '2rem' }}>Invoice not found{offline ? ' (and you are offline — it may not be cached yet)' : ''}</main>

  const balanceDue = invoice.total - invoice.amount_paid
  const status = balanceDue <= 0 ? 'Paid' : invoice.amount_paid > 0 ? 'Partially Paid' : 'On Credit'
  const statusColor = balanceDue <= 0 ? '#16a34a' : invoice.amount_paid > 0 ? '#d97706' : '#dc2626'

  return (
    <main style={{ padding: '2rem', maxWidth: 700 }}>
      {offline && (
        <p style={{ background: '#fef3c7', padding: 8, borderRadius: 4, marginBottom: 16 }}>
          ⚠️ You're offline. Showing last saved data.
        </p>
      )}
      <button onClick={() => window.print()} style={{ marginBottom: 16, padding: '8px 16px' }}>
        Print
      </button>
      <h1>Invoice</h1>
      <p><strong>Customer:</strong> {invoice.parties?.name}</p>
      <p><strong>Date:</strong> {invoice.invoice_date}</p>
      <p>
        <strong>Status:</strong>{' '}
        <span style={{ color: statusColor, fontWeight: 'bold' }}>{status}</span>
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th>Product</th>
            <th>Weight (kg)</th>
            <th>Rate / Maund</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
              <td>{item.products?.name}</td>
              <td>{item.weight_kg}</td>
              <td>Rs. {item.rate_per_maund}</td>
              <td>Rs. {item.line_total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16 }}>
        <p><strong>Grand Total:</strong> Rs. {invoice.total}</p>
        <p><strong>Paid:</strong> Rs. {invoice.amount_paid}</p>
        <p style={{ color: balanceDue > 0 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
          Balance Due: Rs. {balanceDue.toFixed(2)}
        </p>
        {invoice.broker_id && (
          <p><strong>Broker:</strong> {invoice.parties?.name === invoice.broker_name ? '' : invoice.broker_name} — Brokerage: Rs. {invoice.brokerage_amount}</p>
        )}
      </div>
    </main>
  )
}