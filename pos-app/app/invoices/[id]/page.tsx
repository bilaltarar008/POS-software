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

  return (
    <main style={{ padding: '2rem', maxWidth: 700 }}>
      <button onClick={() => window.print()} style={{ marginBottom: 16, padding: '8px 16px' }}>
        Print
      </button>
      <h1>Invoice</h1>
      <p><strong>Customer:</strong> {invoice.parties?.name}</p>
      <p><strong>Date:</strong> {invoice.invoice_date}</p>

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

      <h2 style={{ marginTop: 16 }}>Grand Total: Rs. {invoice.total}</h2>
    </main>
  )
}