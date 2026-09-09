'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { localDb } from '@/lib/db'
import { isOnline, queueOp, withTimeout } from '@/lib/sync'
import { useSyncStatus } from '@/lib/useSyncStatus'

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
  const pendingCount = useSyncStatus()

  useEffect(() => {
    const fetchData = async () => {
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
      invoice_date: new Date().toISOString().split('T')[0],
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
      <main className="page-container max-w-sm">
        <h1 className="text-2xl font-bold mb-4">Saved Offline</h1>
        {pendingCount !== null && pendingCount > 0 && (
          <p className="bg-amber-100 text-amber-800 p-3 rounded mb-3">
            No internet connection — this invoice was saved on your device and will sync to the cloud automatically once you're back online.
          </p>
        )}
        {pendingCount === 0 && (
          <p className="bg-green-100 text-green-800 p-3 rounded mb-3">
            ✅ Synced! This invoice has been saved to the cloud.
          </p>
        )}
        <a href="/" className="text-blue-600 hover:underline">← Back to Products</a>
      </main>
    )
  }

  return (
    <main className="page-container max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">New Invoice</h1>
      <form onSubmit={handleSubmit}>
        <label className="label-text">Customer</label>
        <select
          value={partyId}
          onChange={(e) => setPartyId(e.target.value)}
          required
          className="input-field mb-2"
        >
          <option value="">Select a customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <a href="/parties/new" className="text-blue-600 hover:underline text-sm inline-block mb-4">
          + Add a new customer
        </a>

        <label className="label-text">Broker (optional)</label>
        <select
          value={brokerId}
          onChange={(e) => setBrokerId(e.target.value)}
          className="input-field mb-4"
        >
          <option value="">No broker</option>
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>{b.name} ({b.brokerage_fee_percent}%)</option>
          ))}
        </select>

        <h3 className="font-semibold mb-2">Items</h3>
        {items.map((item, index) => (
          <div key={index} className="flex flex-col sm:flex-row gap-2 mb-2 sm:items-center">
            <select
              value={item.productId}
              onChange={(e) => updateItem(index, 'productId', e.target.value)}
              required
              className="input-field sm:flex-[2]"
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
              className="input-field sm:flex-1"
            />

            <input
              type="number"
              step="0.01"
              value={item.ratePerMaund}
              onChange={(e) => updateItem(index, 'ratePerMaund', parseFloat(e.target.value) || 0)}
              placeholder="Rate / Maund"
              required
              className="input-field sm:flex-1"
            />

            <span className="sm:flex-1 text-sm font-medium">Rs. {lineTotal(item).toFixed(2)}</span>

            {items.length > 1 && (
              <button type="button" onClick={() => removeItem(index)} className="text-red-600 self-start sm:self-auto">✕</button>
            )}
          </div>
        ))}

        <button type="button" onClick={addItem} className="btn-secondary mb-4 text-sm">
          + Add Item
        </button>

        <h3 className="text-lg font-semibold">Grand Total: Rs. {grandTotal.toFixed(2)}</h3>

        {selectedBroker && (
          <p className="text-amber-700 mt-1">
            Brokerage ({selectedBroker.brokerage_fee_percent}%): Rs. {brokerageAmount.toFixed(2)}
          </p>
        )}

        <div className="mt-4 p-4 bg-gray-100 rounded-lg">
          <label className="label-text">Amount Paid Now</label>
          <input
            type="number"
            step="0.01"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            className="input-field mb-2"
          />
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setAmountPaid(grandTotal.toString())} className="btn-secondary text-sm">
              Mark Fully Paid
            </button>
            <button type="button" onClick={() => setAmountPaid('0')} className="btn-secondary text-sm">
              Fully on Credit
            </button>
          </div>
          <p className={`font-bold ${creditAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {creditAmount > 0 ? `On Credit: Rs. ${creditAmount.toFixed(2)}` : 'Fully Paid'}
          </p>
        </div>

        {error && <p className="text-red-600 mt-3">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary mt-4 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Invoice'}
        </button>
      </form>
    </main>
  )
}