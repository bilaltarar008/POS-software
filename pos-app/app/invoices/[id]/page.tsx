'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function InvoiceViewPage() {
  const { id } = useParams()
  const [invoice, setInvoice] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('*, parties(name)')
        .eq('id', id)
        .single()
      setInvoice(invoiceData)

      const { data: itemData } = await supabase
        .from('invoice_items')
        .select('*, products(name)')
        .eq('invoice_id', id)
      setItems(itemData || [])

      setLoading(false)
    }
    fetchData()
  }, [id])

  if (loading) return <main style={{ padding: '2rem' }}>Loading...</main>
  if (!invoice) return <main style={{ padding: '2rem' }}>Invoice not found</main>

  const balanceDue = invoice.total - invoice.amount_paid
  const status = balanceDue <= 0 ? 'Paid' : invoice.amount_paid > 0 ? 'Partially Paid' : 'On Credit'
  const statusColor = balanceDue <= 0 ? '#16a34a' : invoice.amount_paid > 0 ? '#d97706' : '#dc2626'

  return (
    <main style={{ padding: '2rem', maxWidth: 700 }}>
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
      </div>
    </main>
  )
}