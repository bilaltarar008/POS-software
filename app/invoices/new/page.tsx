'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { localDb } from '@/lib/db'
import { isOnline, queueOp, withTimeout } from '@/lib/sync'

type LineItem = {
  productId: string
  weightKg: number
  ratePerMaund: number
  costPerMaund: number
}

export default function NewInvoicePage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [brokers, setBrokers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [partyId, setPartyId] = useState('')
  const [brokerId, setBrokerId] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { productId: '', weightKg: 40, ratePerMaund: 0, costPerMaund: 0 },
  ])
  const [amountPaid, setAmountPaid] = useState('0')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      // Customers
      try {
        const { data, error } = await withTimeout(
          supabase.from('parties').select('id, name, type').eq('type', 'customer').order('name')
        )
        if (error) throw error
        setCustomers(data || [])
        await localDb.parties.bulkPut(data || [])
      } catch {
        const cached = await localDb.parties.where('type').equals('customer').toArray()
        setCustomers(cached)
      }

      // Brokers
      try {
        const { data, error } = await withTimeout(
          supabase.from('parties').select('id, name, type, brokerage_fee_percent').eq('type', 'broker').order('name')
        )
        if (error) throw error
        setBrokers(data || [])
        await localDb.parties.bulkPut(data || [])
      } catch {
        const cached = await localDb.parties.where('type').equals('broker').toArray()
        setBrokers(cached as any[])
      }

      // Products
      try {
        const { data, error } = await withTimeout(
          supabase.from('products').select('id, name, price_per_maund, cost_price_per_maund').order('name')
        )
        if (error) throw error
        setProducts(data || [])
        await localDb.products.bulkPut(
          (data || []).map((p: any) => ({ ...p, category_id: p.category_id || '' }))
        )
      } catch {
        const cached = await localDb.products.toArray()
        setProducts(cached)
      }
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

  const selectedBroker = brokers.find((b) => b.id === brokerId)
  const brokerageAmount = selectedBroker
    ? (grandTotal * selectedBroker.brokerage_fee_percent) / 100
    : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const invoiceId = uuidv4()

      const invoiceRow = {
      id: invoiceId,
      party_id: partyId,
      total: grandTotal,
      amount_paid: paidNum,
      broker_id: brokerId || null,
      brokerage_amount: brokerageAmount,
      invoice_date: new Date().toISOString().split('T')[0], // e.g. "2026-09-06"
    }

    const itemRows = items.map((item) => ({
      id: uuidv4(),
      invoice_id: invoiceId,
      product_id: item.productId,
      weight_kg: item.weightKg,
      rate_per_maund: item.ratePerMaund,
      line_total: lineTotal(item),
      cost_per_maund: item.costPerMaund,
    }))

    const saleLedgerRow = {
      id: uuidv4(),
      party_id: partyId,
      invoice_id: invoiceId,
      entry_type: 'sale',
      amount: grandTotal,
      note: `Invoice #${invoiceId.slice(0, 8)}`,
    }

    const paymentLedgerRow = paidNum > 0 ? {
      id: uuidv4(),
      party_id: partyId,
      invoice_id: invoiceId,
      entry_type: 'payment_received',
      amount: -paidNum,
      note: `Paid at time of Invoice #${invoiceId.slice(0, 8)}`,
    } : null

    const brokerLedgerRow = (brokerId && brokerageAmount > 0) ? {
      id: uuidv4(),
      party_id: brokerId,
      invoice_id: invoiceId,
      entry_type: 'purchase',
      amount: brokerageAmount,
      note: `Brokerage for Invoice #${invoiceId.slice(0, 8)}`,
    } : null

    const online = await isOnline()

    if (online) {
      const { error: invoiceError } = await supabase.from('invoices').insert(invoiceRow)
      if (invoiceError) { setError(invoiceError.message); setSaving(false); return }

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows)
      if (itemsError) { setError(itemsError.message); setSaving(false); return }

      const { error: saleError } = await supabase.from('ledger_entries').insert(saleLedgerRow)
      if (saleError) { setError(saleError.message); setSaving(false); return }

      if (paymentLedgerRow) {
        const { error: payError } = await supabase.from('ledger_entries').insert(paymentLedgerRow)
        if (payError) { setError(payError.message); setSaving(false); return }
      }

      if (brokerLedgerRow) {
        const { error: brokerError } = await supabase.from('ledger_entries').insert(brokerLedgerRow)
        if (brokerError) { setError(brokerError.message); setSaving(false); return }
      }

      router.push(`/invoices/${invoiceId}`)
    } else {
      await localDb.invoices.put(invoiceRow)
      await queueOp('invoices', 'insert', invoiceRow)

      for (const item of itemRows) {
        await queueOp('invoice_items', 'insert', item)
      }

      await queueOp('ledger_entries', 'insert', saleLedgerRow)
      if (paymentLedgerRow) await queueOp('ledger_entries', 'insert', paymentLedgerRow)
      if (brokerLedgerRow) await queueOp('ledger_entries', 'insert', brokerLedgerRow)

      setSavedOffline(true)
      setSaving(false)
    }
  }

  if (savedOffline) {
    return (
      <main style={{ padding: '2rem', maxWidth: 400 }}>
        <h1>Saved Offline</h1>
        <p style={{ background: '#fef3c7', padding: 12, borderRadius: 4 }}>
          No internet connection — this invoice was saved on your device and will sync to the cloud automatically once you're back online.
        </p>
        <a href="/">← Back to Products</a>
      </main>
    )
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

        <label style={{ display: 'block', marginBottom: 4 }}>Broker (optional)</label>
        <select
          value={brokerId}
          onChange={(e) => setBrokerId(e.target.value)}
          style={{ display: 'block', marginBottom: 16, width: '100%', padding: 8 }}
        >
          <option value="">No broker</option>
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>{b.name} ({b.brokerage_fee_percent}%)</option>
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
              onChange={(e) => updateItem(index, 'weightKg', parseFloat(e.target.value) || 0)}
              placeholder="Weight (kg)"
              required
              style={{ flex: 1, padding: 8 }}
            />

            <input
              type="number"
              step="0.01"
              value={item.ratePerMaund}
              onChange={(e) => updateItem(index, 'ratePerMaund', parseFloat(e.target.value) || 0)}
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

        {selectedBroker && (
          <p style={{ color: '#d97706' }}>
            Brokerage ({selectedBroker.brokerage_fee_percent}%): Rs. {brokerageAmount.toFixed(2)}
          </p>
        )}

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
            {creditAmount > 0 ? `On Credit: Rs. ${creditAmount.toFixed(2)}` : 'Fully Paid'}
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