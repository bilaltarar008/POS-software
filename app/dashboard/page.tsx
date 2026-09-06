'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { localDb } from '@/lib/db'
import { withTimeout } from '@/lib/sync'

export default function DashboardPage() {
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
    const computeEverything = (
      parties: any[],
      entries: any[],
      capital: any[],
      invoices: any[],
      items: any[]
    ) => {
      setTotalSales(
        entries.filter((e) => e.entry_type === 'sale').reduce((sum, e) => sum + Number(e.amount), 0)
      )

      setTotalReceived(
        Math.abs(
          entries
            .filter((e) => e.entry_type === 'payment_received')
            .reduce((sum, e) => sum + Number(e.amount), 0)
        )
      )

      setTotalCapital(capital.reduce((sum, e) => sum + Number(e.amount), 0))

      setTotalBrokerage(invoices.reduce((sum, i) => sum + Number(i.brokerage_amount || 0), 0))

      const balanceMap: Record<string, number> = {}
      entries.forEach((e) => {
        balanceMap[e.party_id] = (balanceMap[e.party_id] || 0) + Number(e.amount)
      })

      const balances = parties
        .map((p) => ({ ...p, balance: balanceMap[p.id] || 0 }))
        .filter((p) => Math.abs(p.balance) > 0.01)
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))

      setPartyBalances(balances)

      setTotalCreditOut(
        balances.filter((p) => p.type === 'customer' && p.balance > 0).reduce((sum, p) => sum + p.balance, 0)
      )
      setTotalCreditIn(
        balances
          .filter((p) => (p.type === 'supplier' || p.type === 'broker') && p.balance > 0)
          .reduce((sum, p) => sum + p.balance, 0)
      )

      let profit = 0
      const productMap: Record<string, any> = {}

      items.forEach((item: any) => {
        const maunds = item.weight_kg / 40
        const revenue = maunds * item.rate_per_maund
        const cost = maunds * item.cost_per_maund
        profit += revenue - cost

        const key = item.product_id
        if (!productMap[key]) {
          productMap[key] = {
            name: item.product_name || item.products?.name || 'Unknown',
            totalWeightKg: 0,
            revenue: 0,
            profit: 0,
          }
        }
        productMap[key].totalWeightKg += Number(item.weight_kg)
        productMap[key].revenue += revenue
        productMap[key].profit += revenue - cost
      })

      setTotalProfit(profit)
      setProductStats(Object.values(productMap).sort((a: any, b: any) => b.revenue - a.revenue))
    }

    const fetchData = async () => {
      try {
        const { data: parties, error: e1 } = await withTimeout(
          supabase.from('parties').select('id, name, type')
        )
        if (e1) throw e1

        const { data: entries, error: e2 } = await withTimeout(
          supabase.from('ledger_entries').select('*')
        )
        if (e2) throw e2

        const { data: capital, error: e3 } = await withTimeout(
          supabase.from('capital_entries').select('*')
        )
        if (e3) throw e3

        const { data: invoices, error: e4 } = await withTimeout(
          supabase.from('invoices').select('brokerage_amount')
        )
        if (e4) throw e4

        const { data: items, error: e5 } = await withTimeout(
          supabase.from('invoice_items').select('*, products(name)')
        )
        if (e5) throw e5

        setOffline(false)

        // Cache everything for offline use
        await localDb.parties.bulkPut(parties || [])
        await localDb.ledger_entries.bulkPut(entries || [])
        await localDb.capital_entries.bulkPut(capital || [])
        await localDb.invoice_items.bulkPut(
          (items || []).map((item: any) => ({
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

        computeEverything(parties || [], entries || [], capital || [], invoices || [], items || [])
      } catch {
        setOffline(true)
        const parties = await localDb.parties.toArray()
        const entries = await localDb.ledger_entries.toArray()
        const capital = await localDb.capital_entries.toArray()
        const items = await localDb.invoice_items.toArray()
        const invoices = await localDb.invoices.toArray()

        computeEverything(parties, entries, capital, invoices, items)
      }
      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) return <main style={{ padding: '2rem' }}>Loading...</main>

  return (
    <main style={{ padding: '2rem' }}>
      {offline && (
        <p style={{ background: '#fef3c7', padding: 8, borderRadius: 4, marginBottom: 16 }}>
          ⚠️ You're offline. Showing last saved data.
        </p>
      )}
      <h1>Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
          <p>Capital Entered</p>
          <h2>Rs. {totalCapital.toFixed(2)}</h2>
        </div>
        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
          <p>Total Sales (Invoiced)</p>
          <h2>Rs. {totalSales.toFixed(2)}</h2>
        </div>
        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
          <p>Total Received (Cash In)</p>
          <h2>Rs. {totalReceived.toFixed(2)}</h2>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 }}>
        <div style={{ padding: 16, border: '1px solid #dc2626', borderRadius: 8 }}>
          <p>Credit Owed to You (by customers)</p>
          <h2 style={{ color: '#dc2626' }}>Rs. {totalCreditOut.toFixed(2)}</h2>
        </div>
        <div style={{ padding: 16, border: '1px solid #d97706', borderRadius: 8 }}>
          <p>You Owe (to suppliers/brokers)</p>
          <h2 style={{ color: '#d97706' }}>Rs. {totalCreditIn.toFixed(2)}</h2>
        </div>
        <div style={{ padding: 16, border: '1px solid #d97706', borderRadius: 8 }}>
          <p>Total Brokerage Paid/Owed</p>
          <h2 style={{ color: '#d97706' }}>Rs. {totalBrokerage.toFixed(2)}</h2>
        </div>
        <div style={{ padding: 16, border: `1px solid ${totalProfit >= 0 ? '#16a34a' : '#dc2626'}`, borderRadius: 8 }}>
          <p>Total Profit / Loss</p>
          <h2 style={{ color: totalProfit >= 0 ? '#16a34a' : '#dc2626' }}>Rs. {totalProfit.toFixed(2)}</h2>
        </div>
      </div>

      <h2 style={{ marginTop: 32 }}>Who Owes What</h2>
      {partyBalances.length === 0 && <p>No outstanding balances.</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th>Party</th>
            <th>Type</th>
            <th>Balance</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {partyBalances.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td>{p.name}</td>
              <td style={{ textTransform: 'capitalize' }}>{p.type}</td>
              <td style={{ color: p.balance > 0 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
                Rs. {Math.abs(p.balance).toFixed(2)}
              </td>
              <td>
                {p.type === 'customer'
                  ? p.balance > 0 ? 'Owes you' : 'They overpaid / credit balance'
                  : p.balance > 0 ? 'You owe them' : 'You overpaid / credit balance'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Sales by Product</h2>
      {productStats.length === 0 && <p>No sales yet.</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th>Product</th>
            <th>Total Weight Sold</th>
            <th>Revenue</th>
            <th>Profit</th>
          </tr>
        </thead>
        <tbody>
          {productStats.map((p: any, i: number) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td>{p.name}</td>
              <td>{p.totalWeightKg} kg ({(p.totalWeightKg / 40).toFixed(2)} maund)</td>
              <td>Rs. {p.revenue.toFixed(2)}</td>
              <td style={{ color: p.profit >= 0 ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                Rs. {p.profit.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}