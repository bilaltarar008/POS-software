'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type LineItem = {
  productId: string
  weightKg: number
  ratePerMaund: number
}

export default function NewInvoicePage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [partyId, setPartyId] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { productId: '', weightKg: 40, ratePerMaund: 0 },
  ])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      const { data: customerData } = await supabase
        .from('parties')
        .select('id, name')
        .eq('type', 'customer')
        .order('name')
      setCustomers(customerData || [])

      const { data: productData } = await supabase
        .from('products')
        .select('id, name, price_per_maund')
        .order('name')
      setProducts(productData || [])
    }
    fetchData()
  }, [])

  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }

    // Auto-fill rate when product is selected
    if (field === 'productId') {
      const product = products.find((p) => p.id === value)
      if (product) newItems[index].ratePerMaund = product.price_per_maund
    }

    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { productId: '', weightKg: 40, ratePerMaund: 0 }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const lineTotal = (item: LineItem) => (item.weightKg / 40) * item.ratePerMaund

  const grandTotal = items.reduce((sum, item) => sum + lineTotal(item), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    // Step 1: create the invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({ party_id: partyId, total: grandTotal })
      .select()
      .single()

    if (invoiceError || !invoice) {
      setError(invoiceError?.message || 'Failed to create invoice')
      setSaving(false)
      return
    }

    // Step 2: create the line items, linked to that invoice
    const itemRows = items.map((item) => ({
      invoice_id: invoice.id,
      product_id: item.productId,
      weight_kg: item.weightKg,
      rate_per_maund: item.ratePerMaund,
      line_total: lineTotal(item),
    }))

    const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows)

    if (itemsError) {
      setError(itemsError.message)
      setSaving(false)
      return
    }

    router.push(`/invoices/${invoice.id}`)
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 700 }}>
      <h1>New Invoice</h1>
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 4 }}>Customer</label>
        <select
          value={partyId}
          onChange={(e) => setPartyId(e.target.value)}
          required
          style={{ display: 'block', marginBottom: 16, width: '100%', padding: 8 }}
        >
          <option value="">Select a customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <h3>Items</h3>
        {items.map((item, index) => (
          <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <select
              value={item.productId}
              onChange={(e) => updateItem(index, 'productId', e.target.value)}
              required
              style={{ flex: 2, padding: 8 }}
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <input
              type="number"
              value={item.weightKg}
              onChange={(e) => updateItem(index, 'weightKg', parseFloat(e.target.value))}
              placeholder="Weight (kg)"
              required
              style={{ flex: 1, padding: 8 }}
            />

            <input
              type="number"
              step="0.01"
              value={item.ratePerMaund}
              onChange={(e) => updateItem(index, 'ratePerMaund', parseFloat(e.target.value))}
              placeholder="Rate / Maund"
              required
              style={{ flex: 1, padding: 8 }}
            />

            <span style={{ flex: 1 }}>Rs. {lineTotal(item).toFixed(2)}</span>

            {items.length > 1 && (
              <button type="button" onClick={() => removeItem(index)}>✕</button>
            )}
          </div>
        ))}

        <button type="button" onClick={addItem} style={{ marginBottom: 16 }}>
          + Add Item
        </button>

        <h3>Grand Total: Rs. {grandTotal.toFixed(2)}</h3>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit" disabled={saving} style={{ padding: '8px 16px' }}>
          {saving ? 'Saving...' : 'Save Invoice'}
        </button>
      </form>
    </main>
  )
}