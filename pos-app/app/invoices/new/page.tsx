'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type LineItem = {
  productId: string
  weightKg: number
  ratePerMaund: number
  costPerMaund: number
}

export default function NewInvoicePage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [partyId, setPartyId] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { productId: '', weightKg: 40, ratePerMaund: 0, costPerMaund: 0 },
  ])
  const [amountPaid, setAmountPaid] = useState('0')
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
        .select('id, name, price_per_maund, cost_price_per_maund')
        .order('name')
      setProducts(productData || [])
    }
    fetchData()
  }, [])

  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }

    if (field === 'productId') {
      const product = products.find((p) => p.id === value)
      if (product) {
        newItems[index].ratePerMaund = product.price_per_maund
        newItems[index].costPerMaund = product.cost_price_per_maund
      }
    }

    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { productId: '', weightKg: 40, ratePerMaund: 0, costPerMaund: 0 }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const lineTotal = (item: LineItem) => (item.weightKg / 40) * item.ratePerMaund

  const grandTotal = items.reduce((sum, item) => sum + lineTotal(item), 0)
  const paidNum = parseFloat(amountPaid) || 0
  const creditAmount = grandTotal - paidNum

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    // Step 1: create the invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({ party_id: partyId, total: grandTotal, amount_paid: paidNum })
      .select()
      .single()

    if (invoiceError || !invoice) {
      setError(invoiceError?.message || 'Failed to create invoice')
      setSaving(false)
      return
    }

    // Step 2: create the line items
    const itemRows = items.map((item) => ({
      invoice_id: invoice.id,
      product_id: item.productId,
      weight_kg: item.weightKg,
      rate_per_maund: item.ratePerMaund,
      line_total: lineTotal(item),
      cost_per_maund: item.costPerMaund,
    }))

    const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows)

    if (itemsError) {
      setError(itemsError.message)
      setSaving(false)
      return
    }

    // Step 3: ledger entry for the full sale (customer owes this)
    const { error: saleLedgerError } = await supabase.from('ledger_entries').insert({
      party_id: partyId,
      invoice_id: invoice.id,
      entry_type: 'sale',
      amount: grandTotal,
      note: `Invoice #${invoice.id.slice(0, 8)}`,
    })

    if (saleLedgerError) {
      setError(saleLedgerError.message)
      setSaving(false)
      return
    }

    // Step 4: if they paid something right now, log that as a separate ledger entry
    if (paidNum > 0) {
      const { error: paymentLedgerError } = await supabase.from('ledger_entries').insert({
        party_id: partyId,
        invoice_id: invoice.id,
        entry_type: 'payment_received',
        amount: -paidNum,
        note: `Paid at time of Invoice #${invoice.id.slice(0, 8)}`,
      })

      if (paymentLedgerError) {
        setError(paymentLedgerError.message)
        setSaving(false)
        return
      }
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

        <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Amount Paid Now</label>
          <input
            type="number"
            step="0.01"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            style={{ display: 'block', marginBottom: 8, width: '100%', padding: 8 }}
          />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button type="button" onClick={() => setAmountPaid(grandTotal.toString())}>
              Mark Fully Paid
            </button>
            <button type="button" onClick={() => setAmountPaid('0')}>
              Fully on Credit
            </button>
          </div>
          <p style={{ margin: 0, fontWeight: 'bold', color: creditAmount > 0 ? '#dc2626' : '#16a34a' }}>
            {creditAmount > 0
              ? `On Credit: Rs. ${creditAmount.toFixed(2)}`
              : 'Fully Paid'}
          </p>
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit" disabled={saving} style={{ padding: '8px 16px', marginTop: 16 }}>
          {saving ? 'Saving...' : 'Save Invoice'}
        </button>
      </form>
    </main>
  )
}