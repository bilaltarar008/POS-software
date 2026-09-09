'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { localDb } from '@/lib/db'
import { withTimeout } from '@/lib/sync'

type RangeOption = 'all' | 'this_month' | 'last_month' | 'this_year' | 'custom'

function getRangeDates(range: RangeOption, customStart: string, customEnd: string): { start: string | null; end: string | null } {
  const now = new Date()
  if (range === 'all') return { start: null, end: null }
  if (range === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: start.toISOString().split('T')[0], end: null }
  }
  if (range === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
  }
  if (range === 'this_year') {
    const start = new Date(now.getFullYear(), 0, 1)
    return { start: start.toISOString().split('T')[0], end: null }
  }
  return { start: customStart || null, end: customEnd || null }
}

export default function DashboardPage() {
  const [range, setRange] = useState<RangeOption>('this_month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [allParties, setAllParties] = useState<any[]>([])
  const [allEntries, setAllEntries] = useState<any[]>([])
  const [allCapital, setAllCapital] = useState<any[]>([])
  const [allInvoices, setAllInvoices] = useState<any[]>([])
  const [allItems, setAllItems] = useState<any[]>([])

  const [totalSales, setTotalSales] = useState(0)
  const [totalCapital, setTotalCapital] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [totalReceived, setTotalReceived] = useState(0)
  const [totalCreditOut, setTotalCreditOut] = useState(0)
  const [totalCreditIn, setTotalCreditIn] = useState(0)
  const [totalBrokerage, setTotalBrokerage] = useState(0)
  const [partyBalances, setPartyBalances] = useState<any[]>([])
  const [productStats, setProductStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: parties, error: e1 } = await withTimeout(supabase.from('parties').select('id, name, type'))
        if (e1) throw e1
        const { data: entries, error: e2 } = await withTimeout(supabase.from('ledger_entries').select('*'))
        if (e2) throw e2
        const { data: capital, error: e3 } = await withTimeout(supabase.from('capital_entries').select('*'))
        if (e3) throw e3
        const { data: invoices, error: e4 } = await withTimeout(supabase.from('invoices').select('id, brokerage_amount, invoice_date'))
        if (e4) throw e4
        const { data: items, error: e5 } = await withTimeout(supabase.from('invoice_items').select('*, products(name), invoices(invoice_date)'))
        if (e5) throw e5

        setOffline(false)

        await localDb.parties.bulkPut(parties || [])
        await localDb.ledger_entries.bulkPut(entries || [])
        await localDb.capital_entries.bulkPut(capital || [])
        await localDb.invoices.bulkPut(
          (invoices || []).map((inv: any) => ({
            id: inv.id, party_id: '', broker_id: null, invoice_date: inv.invoice_date,
            total: 0, amount_paid: 0, brokerage_amount: inv.brokerage_amount,
          }))
        )
        await localDb.invoice_items.bulkPut(
          (items || []).map((item: any) => ({
            id: item.id, invoice_id: item.invoice_id, product_id: item.product_id,
            weight_kg: item.weight_kg, rate_per_maund: item.rate_per_maund,
            line_total: item.line_total, cost_per_maund: item.cost_per_maund,
            product_name: item.products?.name,
          }))
        )

        setAllParties(parties || [])
        setAllEntries((entries || []).map((e: any) => ({ ...e, date: e.created_at?.split('T')[0] })))
        setAllCapital((capital || []).map((c: any) => ({ ...c, date: c.entry_date })))
        setAllInvoices(invoices || [])
        setAllItems((items || []).map((item: any) => ({ ...item, product_name: item.products?.name, invoice_date: item.invoices?.invoice_date })))
      } catch {
        setOffline(true)
        const parties = await localDb.parties.toArray()
        const entries = await localDb.ledger_entries.toArray()
        const capital = await localDb.capital_entries.toArray()
        const invoices = await localDb.invoices.toArray()
        const items = await localDb.invoice_items.toArray()

        setAllParties(parties)
        setAllEntries(entries.map((e: any) => ({ ...e, date: null })))
        setAllCapital(capital.map((c: any) => ({ ...c, date: c.entry_date })))
        setAllInvoices(invoices)
        setAllItems(items.map((item: any) => ({ ...item, invoice_date: null })))
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (loading) return
    const { start, end } = getRangeDates(range, customStart, customEnd)
    const inRange = (dateStr: string | null | undefined) => {
      if (!dateStr) return range === 'all'
      if (start && dateStr < start) return false
      if (end && dateStr > end) return false
      return true
    }

    const entries = allEntries.filter((e) => inRange(e.date))
    const capital = allCapital.filter((c) => inRange(c.date))
    const invoices = allInvoices.filter((i) => inRange(i.invoice_date))
    const items = allItems.filter((i) => inRange(i.invoice_date))

    setTotalSales(entries.filter((e) => e.entry_type === 'sale').reduce((sum, e) => sum + Number(e.amount), 0))
    setTotalReceived(Math.abs(entries.filter((e) => e.entry_type === 'payment_received').reduce((sum, e) => sum + Number(e.amount), 0)))
    setTotalCapital(capital.reduce((sum, e) => sum + Number(e.amount), 0))
    setTotalBrokerage(invoices.reduce((sum, i) => sum + Number(i.brokerage_amount || 0), 0))

    const balanceMap: Record<string, number> = {}
    allEntries.forEach((e) => { balanceMap[e.party_id] = (balanceMap[e.party_id] || 0) + Number(e.amount) })
    const balances = allParties
      .map((p) => ({ ...p, balance: balanceMap[p.id] || 0 }))
      .filter((p) => Math.abs(p.balance) > 0.01)
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    setPartyBalances(balances)
    setTotalCreditOut(balances.filter((p) => p.type === 'customer' && p.balance > 0).reduce((sum, p) => sum + p.balance, 0))
    setTotalCreditIn(balances.filter((p) => (p.type === 'supplier' || p.type === 'broker') && p.balance > 0).reduce((sum, p) => sum + p.balance, 0))

    let profit = 0
    const productMap: Record<string, any> = {}
    items.forEach((item: any) => {
      const maunds = item.weight_kg / 40
      const revenue = maunds * item.rate_per_maund
      const cost = maunds * item.cost_per_maund
      profit += revenue - cost
      const key = item.product_id
      if (!productMap[key]) productMap[key] = { name: item.product_name || 'Unknown', totalWeightKg: 0, revenue: 0, profit: 0 }
      productMap[key].totalWeightKg += Number(item.weight_kg)
      productMap[key].revenue += revenue
      productMap[key].profit += revenue - cost
    })
    setTotalProfit(profit)
    setProductStats(Object.values(productMap).sort((a: any, b: any) => b.revenue - a.revenue))
  }, [range, customStart, customEnd, loading, allEntries, allCapital, allInvoices, allItems, allParties])

  if (loading) return <main className="page-container">Loading...</main>

  return (
    <main className="page-container">
      {offline && (
        <p className="bg-amber-100 text-amber-800 p-2 rounded mb-4 text-sm">
          ⚠️ You're offline. Showing last saved data. Date filtering may be limited until you're back online.
        </p>
      )}
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="flex flex-wrap gap-2 items-center mt-4">
        <label className="text-sm font-medium">Show:</label>
        <select value={range} onChange={(e) => setRange(e.target.value as RangeOption)} className="input-field w-auto">
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="this_year">This Year</option>
          <option value="all">All Time</option>
          <option value="custom">Custom Range</option>
        </select>
        {range === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input-field w-auto" />
            <span>to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input-field w-auto" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        <div className="card"><p className="text-sm text-gray-600">Capital Entered</p><h2 className="text-xl font-bold">Rs. {totalCapital.toFixed(2)}</h2></div>
        <div className="card"><p className="text-sm text-gray-600">Total Sales (Invoiced)</p><h2 className="text-xl font-bold">Rs. {totalSales.toFixed(2)}</h2></div>
        <div className="card"><p className="text-sm text-gray-600">Total Received (Cash In)</p><h2 className="text-xl font-bold">Rs. {totalReceived.toFixed(2)}</h2></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <div className="card border-red-300"><p className="text-sm text-gray-600">Credit Owed to You (all time)</p><h2 className="text-xl font-bold text-red-600">Rs. {totalCreditOut.toFixed(2)}</h2></div>
        <div className="card border-amber-300"><p className="text-sm text-gray-600">You Owe (all time)</p><h2 className="text-xl font-bold text-amber-700">Rs. {totalCreditIn.toFixed(2)}</h2></div>
        <div className="card border-amber-300"><p className="text-sm text-gray-600">Brokerage (selected range)</p><h2 className="text-xl font-bold text-amber-700">Rs. {totalBrokerage.toFixed(2)}</h2></div>
        <div className={`card ${totalProfit >= 0 ? 'border-green-300' : 'border-red-300'}`}>
          <p className="text-sm text-gray-600">Profit / Loss (selected range)</p>
          <h2 className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Rs. {totalProfit.toFixed(2)}</h2>
        </div>
      </div>

      <h2 className="text-lg font-semibold mt-8">Who Owes What (all time)</h2>
      {partyBalances.length === 0 && <p className="text-gray-600">No outstanding balances.</p>}
      <div className="overflow-x-auto mt-2">
        <table className="table-base">
          <thead><tr><th>Party</th><th>Type</th><th>Balance</th><th>Meaning</th></tr></thead>
          <tbody>
            {partyBalances.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="capitalize">{p.type}</td>
                <td className={`font-bold ${p.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>Rs. {Math.abs(p.balance).toFixed(2)}</td>
                <td>{p.type === 'customer' ? (p.balance > 0 ? 'Owes you' : 'They overpaid / credit balance') : (p.balance > 0 ? 'You owe them' : 'You overpaid / credit balance')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold mt-8">Sales by Product (selected range)</h2>
      {productStats.length === 0 && <p className="text-gray-600">No sales in this range.</p>}
      <div className="overflow-x-auto mt-2">
        <table className="table-base">
          <thead><tr><th>Product</th><th>Total Weight Sold</th><th>Revenue</th><th>Profit</th></tr></thead>
          <tbody>
            {productStats.map((p: any, i: number) => (
              <tr key={i}>
                <td>{p.name}</td>
                <td>{p.totalWeightKg} kg ({(p.totalWeightKg / 40).toFixed(2)} maund)</td>
                <td>Rs. {p.revenue.toFixed(2)}</td>
                <td className={`font-bold ${p.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Rs. {p.profit.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}