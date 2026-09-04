'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DashboardPage() {
  const [totalSales, setTotalSales] = useState(0)
  const [totalBrokerage, setTotalBrokerage] = useState(0)
  const [totalCapital, setTotalCapital] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [totalReceived, setTotalReceived] = useState(0)
  const [totalCreditOut, setTotalCreditOut] = useState(0) // customers owe you
  const [totalCreditIn, setTotalCreditIn] = useState(0) // you owe suppliers
  const [partyBalances, setPartyBalances] = useState<any[]>([])
  const [productStats, setProductStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data: sales } = await supabase
        .from('ledger_entries')
        .select('amount')
        .eq('entry_type', 'sale')
      setTotalSales((sales || []).reduce((sum, e) => sum + Number(e.amount), 0))

            const { data: brokerageEntries } = await supabase
        .from('invoices')
        .select('brokerage_amount')
      setTotalBrokerage((brokerageEntries || []).reduce((sum, i) => sum + Number(i.brokerage_amount), 0))

      const { data: received } = await supabase
        .from('ledger_entries')
        .select('amount')
        .eq('entry_type', 'payment_received')
      setTotalReceived(Math.abs((received || []).reduce((sum, e) => sum + Number(e.amount), 0)))

      const { data: capital } = await supabase.from('capital_entries').select('amount')
      setTotalCapital((capital || []).reduce((sum, e) => sum + Number(e.amount), 0))

      // --- Party balances (who owes you, who you owe) ---
      const { data: parties } = await supabase.from('parties').select('id, name, type')
      const { data: entries } = await supabase.from('ledger_entries').select('party_id, amount')

      const balanceMap: Record<string, number> = {}
      entries?.forEach((e) => {
        balanceMap[e.party_id] = (balanceMap[e.party_id] || 0) + Number(e.amount)
      })

      const balances = (parties || [])
        .map((p) => ({ ...p, balance: balanceMap[p.id] || 0 }))
        .filter((p) => Math.abs(p.balance) > 0.01) // only show non-zero balances
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))

      setPartyBalances(balances)

      const creditOut = balances
        .filter((p) => p.type === 'customer' && p.balance > 0)
        .reduce((sum, p) => sum + p.balance, 0)
      setTotalCreditOut(creditOut)

      const creditIn = balances
        .filter((p) => p.type === 'supplier' && p.balance > 0)
        .reduce((sum, p) => sum + p.balance, 0)
      setTotalCreditIn(creditIn)

      // --- Product-level sales & profit ---
      const { data: soldItems } = await supabase
        .from('invoice_items')
        .select('weight_kg, rate_per_maund, cost_per_maund, product_id, products(name)')

      const profit = (soldItems || []).reduce((sum, item) => {
        const maunds = item.weight_kg / 40
        return sum + (maunds * item.rate_per_maund - maunds * item.cost_per_maund)
      }, 0)
      setTotalProfit(profit)

      const productMap: Record<string, any> = {}
      ;(soldItems || []).forEach((item: any) => {
        const maunds = item.weight_kg / 40
        const revenue = maunds * item.rate_per_maund
        const cost = maunds * item.cost_per_maund
        const key = item.product_id

        if (!productMap[key]) {
          productMap[key] = {
            name: item.products?.name || 'Unknown',
            totalWeightKg: 0,
            revenue: 0,
            profit: 0,
          }
        }
        productMap[key].totalWeightKg += Number(item.weight_kg)
        productMap[key].revenue += revenue
        productMap[key].profit += revenue - cost
      })

      const productList = Object.values(productMap).sort((a: any, b: any) => b.revenue - a.revenue)
      setProductStats(productList)

      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return <main style={{ padding: '2rem' }}>Loading...</main>

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Dashboard</h1>

      {/* Top summary cards */}
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

      {/* Credit + profit cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
        <div style={{ padding: 16, border: '1px solid #dc2626', borderRadius: 8 }}>
          <p>Credit Owed to You (by customers)</p>
          <h2 style={{ color: '#dc2626' }}>Rs. {totalCreditOut.toFixed(2)}</h2>
        </div>
        <div style={{ padding: 16, border: '1px solid #d97706', borderRadius: 8 }}>
          <p>You Owe (to suppliers)</p>
          <h2 style={{ color: '#d97706' }}>Rs. {totalCreditIn.toFixed(2)}</h2>
        </div>
        <div style={{ padding: 16, border: `1px solid ${totalProfit >= 0 ? '#16a34a' : '#dc2626'}`, borderRadius: 8 }}>
          <p>Total Profit / Loss</p>
          <h2 style={{ color: totalProfit >= 0 ? '#16a34a' : '#dc2626' }}>Rs. {totalProfit.toFixed(2)}</h2>
        </div>
      </div>

      {/* Party-by-party breakdown */}
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

      {/* Product-by-product breakdown */}
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